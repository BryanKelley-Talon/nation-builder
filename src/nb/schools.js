/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * What the town spends on its schools, and what that buys.
 *
 * BK's direction, 2026-09-20: "need school budget too ... cost benefit analysis." The engine gives the school zone
 * (its stadium, reskinned) no running cost at all, so this is a real line of spending the original does not have:
 * the town pays every year per school it has built, and gets back a town that is easier to govern.
 *
 * Deliberately NOT built here: the longer chain BK described — better schooling to smarter citizens to higher-paying
 * jobs to more tax to more commerce. That is a new subsystem in an engine whose economy is three zone types and a
 * demand valve, and it is captured as its own item rather than faked with a multiplier.
 *
 * This lives in the teaching layer rather than as a fourth slider inside the engine's own budget window. The window
 * computes its three maintenance lines from the census and negotiates shortfalls with the player mid-simulation;
 * adding a fourth to that machinery is real surgery, and it belongs in daylight rather than at half past midnight
 * before a morning playtest.
 */

export const LEVELS = ['none', 'basic', 'full'];
export const DEFAULT_LEVEL = 'basic';

// Cost per school per year, and what that level of funding takes off the town's unrest.
export const FUNDING = Object.freeze({
  none: { cost: 0, relief: 0 },
  basic: { cost: 150, relief: 4 },
  full: { cost: 400, relief: 10 },
});


export function isLevel(value) {
  return LEVELS.includes(value);
}


export function levelOf(value) {
  return isLevel(value) ? value : DEFAULT_LEVEL;
}


// What the town owes this year. Schools are the engine's stadium zones, which the census already counts.
export function yearlyCost(level, schools) {
  return FUNDING[levelOf(level)].cost * Math.max(0, schools);
}


// A town that funds its schools is a steadier town — but only if it has schools to fund. Nothing here rewards
// funding a town has not built.
export function unrestRelief(level, schools, { paid = true } = {}) {
  if (!schools || !paid)
    return 0;
  return FUNDING[levelOf(level)].relief;
}
