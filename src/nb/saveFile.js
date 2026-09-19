/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The city file: everything needed to pick a city back up on any computer. The student keeps it (Google Drive, a
 * USB stick, email to themselves); nothing is stored on a server and nothing in it identifies the student.
 *
 * On disk: gzip-compressed JSON (about 200KB raw, a few KB compressed). Plain JSON is accepted on load too.
 */

export const SAVE_FORMAT = 'nation-builder-city';
export const SAVE_FORMAT_VERSION = 1;
export const SAVE_EXTENSION = '.nbcity';

const GZIP_MAGIC = [0x1f, 0x8b];


async function pipe(bytes, stream) {
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}


// teaching: the teaching-layer state (scenario, pole, town name, code, checkpoint). city: Game/Simulation save data.
export function makeSaveRecord(teaching, city) {
  return {
    format: SAVE_FORMAT,
    version: SAVE_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    teaching,
    city,
  };
}


export async function encodeSaveFile(record) {
  const json = new TextEncoder().encode(JSON.stringify(record));
  if (typeof CompressionStream === 'undefined')
    return json;
  return pipe(json, new CompressionStream('gzip'));
}


// Returns the save record, or throws an Error whose message is safe to show a student.
export async function decodeSaveFile(bytes) {
  bytes = new Uint8Array(bytes);
  let text;

  try {
    if (bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1])
      bytes = await pipe(bytes, new DecompressionStream('gzip'));
    text = new TextDecoder().decode(bytes);
  } catch (e) {
    throw new Error('That file is damaged or isn’t a Nation Builder city file.');
  }

  let record;
  try {
    record = JSON.parse(text);
  } catch (e) {
    throw new Error('That file isn’t a Nation Builder city file.');
  }

  if (!record || record.format !== SAVE_FORMAT)
    throw new Error('That file isn’t a Nation Builder city file.');
  if (record.version > SAVE_FORMAT_VERSION)
    throw new Error('That city was saved by a newer version of Nation Builder. Reload the page and try again.');
  if (!record.city || !Array.isArray(record.city.map) || !record.teaching)
    throw new Error('That city file is incomplete. Try an earlier save.');

  return record;
}


export function saveFileName(townName, year) {
  const town = String(townName || 'Town').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Town';
  return `NationBuilder-${town}-${year}${SAVE_EXTENSION}`;
}
