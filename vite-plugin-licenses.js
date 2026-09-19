/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Ships the license texts beside the built page, so the deployed game carries its own terms.
import { readFileSync } from 'node:fs';

const FILES = ['LICENSE', 'COPYING', 'NOTICE.md', 'MicropolisPublicNameLicense.md', 'content/LICENSE.md'];

export function shipLicenses() {
  return {
    name: 'nation-builder-ship-licenses',
    apply: 'build',
    generateBundle() {
      for (const fileName of FILES) {
        let source;
        try {
          source = readFileSync(fileName, 'utf8');
        } catch (e) {
          continue;
        }
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}
