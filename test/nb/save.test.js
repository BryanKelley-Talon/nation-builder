/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

import { GameMap } from '../../src/gameMap.js';
import { decodeSaveCode, encodeSaveCode, normalizeSaveCode } from '../../src/nb/saveCode.js';
import { decodeSaveFile, encodeSaveFile, makeSaveRecord, saveFileName } from '../../src/nb/saveFile.js';
import { makeSim, runYears, starterTown } from '../sim/harness.js';

const STATE = { scenarioIndex: 0, poleIndex: 2, advisorBits: 0b10100001, year: 1823, population: 4200, score: 612,
                funds: 13875, approval: 64 };

describe('save code', () => {
  it('is 14 characters in groups of four, within the 10-16 + checksum budget', () => {
    expect(encodeSaveCode(STATE)).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/);
  });

  it('round-trips exact fields and buckets headline stats', () => {
    const back = decodeSaveCode(encodeSaveCode(STATE));
    expect(back).toMatchObject({ scenarioIndex: 0, poleIndex: 2, advisorBits: 0b10100001, year: 1823, approval: 64 });
    expect(back.score).toBe(608);
    expect(back.population / 4200).toBeGreaterThan(0.8);
    expect(back.population / 4200).toBeLessThan(1.25);
    expect(back.funds / 13875).toBeGreaterThan(0.8);
    expect(back.funds / 13875).toBeLessThan(1.25);
  });

  it('round-trips a city with no government chosen yet', () => {
    expect(decodeSaveCode(encodeSaveCode({ ...STATE, poleIndex: null })).poleIndex).toBeNull();
  });

  it('forgives case, spaces, dashes and look-alike letters', () => {
    const code = encodeSaveCode(STATE);
    const sloppy = ' ' + code.toLowerCase().replace(/-/g, ' ').replace(/1/g, 'l').replace(/0/g, 'o') + ' ';
    expect(normalizeSaveCode(sloppy)).toBe(code.replace(/-/g, ''));
    expect(decodeSaveCode(sloppy).year).toBe(1823);
  });

  it('catches every single-character typo', () => {
    const code = normalizeSaveCode(encodeSaveCode(STATE));
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    for (let i = 0; i < 12; i++) {
      for (const c of alphabet) {
        if (c === code[i]) continue;
        const typo = code.slice(0, i) + c + code.slice(i + 1);
        expect(() => decodeSaveCode(typo), `${typo}`).toThrow(/typo|different version/);
      }
    }
  });

  it('catches swapped neighbours', () => {
    const code = normalizeSaveCode(encodeSaveCode(STATE));
    for (let i = 0; i < 11; i++) {
      if (code[i] === code[i + 1]) continue;
      const swapped = code.slice(0, i) + code[i + 1] + code[i] + code.slice(i + 2);
      expect(() => decodeSaveCode(swapped)).toThrow();
    }
  });

  it('explains a wrong-length code in plain words', () => {
    expect(() => decodeSaveCode('ABC')).toThrow(/14 letters and numbers/);
  });
});

describe('city file', () => {
  it('round-trips a running city, compressed', async () => {
    const world = makeSim(undefined, { simOptions: { startingYear: 1789, tuning: { taxYield: 1.2 } } });
    starterTown(world);
    runYears(world.sim, 3);
    const city = { name: 'River Town', everClicked: true };
    world.sim.save(city);

    const bytes = await encodeSaveFile(makeSaveRecord({ scenario_id: 'dev-fixture-us11r', pole: 'rousseau' }, city));
    expect(bytes.length).toBeLessThan(40 * 1024);

    const record = await decodeSaveFile(bytes);
    record.city.isSavedGame = true;
    const restored = makeSim(new GameMap(120, 100), { savedGame: record.city });

    expect(record.teaching.pole).toBe('rousseau');
    expect(restored.sim.getDate().year).toBe(1792);
    expect(restored.sim.tuning.taxYield).toBe(1.2);
    expect(restored.map.getTileValue(20, 20)).toBe(world.map.getTileValue(20, 20));
  });

  it('accepts uncompressed JSON', async () => {
    const record = makeSaveRecord({ pole: 'locke' }, { map: [] });
    const bytes = new TextEncoder().encode(JSON.stringify(record));
    expect((await decodeSaveFile(bytes)).teaching.pole).toBe('locke');
  });

  it.each([
    ['a photo', new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])],
    ['some other JSON', new TextEncoder().encode('{"hello": "world"}')],
    ['a damaged gzip', new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0])],
  ])('rejects %s with a message a student can act on', async (_, bytes) => {
    await expect(decodeSaveFile(bytes)).rejects.toThrow(/Nation Builder city file/);
  });

  it('names files after the town and year, safely', () => {
    expect(saveFileName('River Town!', 1823)).toBe('NationBuilder-River-Town-1823.nbcity');
    expect(saveFileName('', 1789)).toBe('NationBuilder-Town-1789.nbcity');
  });
});
