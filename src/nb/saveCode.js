/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The save code: a short, typeable record of a student's teaching-layer state. It fits on a worksheet and a teacher
 * can read it back. It cannot hold the city itself (about 200KB); the city file does that (saveFile.js).
 *
 * Layout: 12 data characters + 2 check characters, Crockford base32, shown as XXXX-XXXX-XXXX-XX.
 * Crockford's alphabet has no I, L, O or U, and decoding reads I/L as 1 and O as 0, so misread letters still work.
 *
 * Data bits (60, most significant first):
 *   version 3 · scenario 7 · pole 3 · advisor decisions 8 · year-1600 10 · population 6 · score 6 · funds 6 ·
 *   approval 7 · spare 4
 * Population and funds are log-scale buckets and score is in steps of 16: headline stats, not exact values.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;
const YEAR_BASE = 1600;
const NO_POLE = 7;

const FIELDS = [
  ['version', 3], ['scenario', 7], ['pole', 3], ['advisors', 8], ['year', 10],
  ['population', 6], ['score', 6], ['funds', 6], ['approval', 7], ['spare', 4],
];

const DATA_CHARS = 12;
const CHECK_CHARS = 2;


const logBucket = n => Math.min(63, Math.round(Math.log2(Math.max(0, n) + 1) * 2));
const fromLogBucket = b => Math.round(2 ** (b / 2) - 1);


function checksum(dataChars) {
  // Position-weighted sum mod a prime just under 32², so any single wrong character or swapped neighbours change it.
  let sum = 0;
  for (let i = 0; i < dataChars.length; i++)
    sum += (i + 1) * (ALPHABET.indexOf(dataChars[i]) + 1);
  const check = sum % 1021;
  return ALPHABET[check >> 5] + ALPHABET[check & 31];
}


// state: {scenarioIndex, poleIndex (or null), advisorBits, year, population, score, funds, approval}
export function encodeSaveCode(state) {
  const values = {
    version: VERSION,
    scenario: state.scenarioIndex,
    pole: state.poleIndex === null || state.poleIndex === undefined ? NO_POLE : state.poleIndex,
    advisors: state.advisorBits || 0,
    year: state.year - YEAR_BASE,
    population: logBucket(state.population),
    score: Math.min(63, Math.floor(Math.max(0, state.score) / 16)),
    funds: logBucket(state.funds),
    approval: Math.max(0, Math.min(100, Math.round(state.approval))),
    spare: 0,
  };

  let bits = 0n;
  for (const [name, width] of FIELDS) {
    const v = values[name];
    if (!Number.isInteger(v) || v < 0 || v >= 2 ** width)
      throw new Error(`Save code field ${name} out of range: ${v}`);
    bits = (bits << BigInt(width)) | BigInt(v);
  }

  let data = '';
  for (let i = DATA_CHARS - 1; i >= 0; i--)
    data += ALPHABET[Number((bits >> BigInt(i * 5)) & 31n)];

  const code = data + checksum(data);
  return code.match(/.{1,4}/g).join('-');
}


export function normalizeSaveCode(input) {
  return String(input).toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
}


// Returns the decoded state, or throws an Error whose message is safe to show a student.
export function decodeSaveCode(input) {
  const code = normalizeSaveCode(input);

  if (code.length !== DATA_CHARS + CHECK_CHARS || [...code].some(c => !ALPHABET.includes(c)))
    throw new Error('That doesn’t look like a Nation Builder code. Codes have 14 letters and numbers.');

  const data = code.slice(0, DATA_CHARS);
  if (checksum(data) !== code.slice(DATA_CHARS))
    throw new Error('That code has a typo somewhere. Check each character against your worksheet.');

  let bits = 0n;
  for (const c of data)
    bits = (bits << 5n) | BigInt(ALPHABET.indexOf(c));

  const values = {};
  for (let i = FIELDS.length - 1; i >= 0; i--) {
    const [name, width] = FIELDS[i];
    values[name] = Number(bits & ((1n << BigInt(width)) - 1n));
    bits >>= BigInt(width);
  }

  if (values.version !== VERSION)
    throw new Error('That code is from a different version of Nation Builder.');

  return {
    scenarioIndex: values.scenario,
    poleIndex: values.pole === NO_POLE ? null : values.pole,
    advisorBits: values.advisors,
    year: values.year + YEAR_BASE,
    population: fromLogBucket(values.population),
    score: values.score * 16,
    funds: fromLogBucket(values.funds),
    approval: values.approval,
  };
}
