/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Ships files beside the built page as they are: the license texts, so the deployed game carries its own terms, and
// content/, which the game fetches at runtime and which stays a separate work under its own license.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FILES = ['LICENSE', 'COPYING', 'NOTICE.md', 'MicropolisPublicNameLicense.md'];
const DIRECTORIES = ['content'];

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function shipLicenses() {
  return {
    name: 'nation-builder-ship-files',
    apply: 'build',
    generateBundle() {
      const files = [...FILES, ...DIRECTORIES.flatMap(walk)];
      for (const fileName of files)
        this.emitFile({ type: 'asset', fileName, source: readFileSync(fileName) });
    },
  };
}
