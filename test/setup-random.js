/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Every test starts from the same engine, whatever ran before it.
//
// Two kinds of ambient state leak between tests, and both have cost this build a green-looking suite:
//
// 1. Randomness. The simulation is random by design (zone growth, problem votes, disasters) and reaches it through
//    the global Math.random — src/random.ts accepts an injectable Math, but the engine never injects one. So a
//    test that waits for a town to grow could pass or fail on suite order alone.
// 2. Engine statics. BaseTool.autoBulldoze is a module-level flag shared by every test in a worker, and
//    test/sim/portBugs.test.js deliberately turns it off and loads it from a save. A later test that builds a town
//    on trees then silently builds nothing — which is exactly how test/sim/succession.test.js came to pass alone
//    and fail in a full run.
//
// Both are reset here rather than in each test: a guarantee in the shared setup beats a rule every test file has
// to remember (house-rules section 6).

import { beforeEach } from 'vitest';

import { BaseTool } from '../src/baseTool.js';

const SEED = 0x4e42;   // "NB"

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  Math.random = mulberry32(SEED);
  BaseTool.setAutoBulldoze(true);
});
