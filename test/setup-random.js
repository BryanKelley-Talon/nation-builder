/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// The simulation is random by design: zone growth, problem votes, disasters. The engine reaches the randomness
// through the global Math.random (src/random.ts takes an injectable Math, but the engine never injects one), so a
// test that waits for a town to grow can pass or fail depending on what ran before it.
//
// Every test therefore starts from the same seeded stream. The sim stays as random as it ever was within a test;
// it just stops depending on the order the suite happens to run in.

import { beforeEach } from 'vitest';

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
});
