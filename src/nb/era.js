/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Era rules: which tools a scenario withholds until a given year, and whether it runs without an electric grid.
 *
 * Both are OFF by default, as of BK's ruling on 2026-09-21: "the year needs to go back to the default micropolis
 * settings...power plants, etc. we need to abandon this timeline of 1750 thing...normal game mechanics." A town
 * plays by the original game's rules — every tool available, power plants and wires required from year one — and
 * the history lives in the scenario's framing rather than in locks on the toolbar.
 *
 * The mechanism stays, because a scenario may still want a gate that teaches something (a town with no organised
 * police before 1838 is a governance question, not trivia — see the 2026-09-20 power-lock memo). A scenario turns
 * one on with era_rules.tool_available_from and era_rules.universal_power_until; nothing is gated unless it does.
 */

// Nothing is withheld by default. A scenario that wants a gate names the tool and the year itself; the years that
// used to live here (rail 1830, police 1838, coal and wire 1882, stadium 1903, airport 1909, nuclear 1957) are in
// the git history and in the handoffs, for whoever brings one back deliberately.
export const DEFAULT_TOOL_AVAILABLE_FROM = Object.freeze({});

// null means "no such period": zones need plants and wires from the first year, as in the original game. A scenario
// that wants a pre-electric stretch sets era_rules.universal_power_until to the year the grid arrives.
export const DEFAULT_UNIVERSAL_POWER_UNTIL = null;


export function eraRules(scenario) {
  const overrides = (scenario && scenario.era_rules) || {};
  return {
    toolAvailableFrom: { ...DEFAULT_TOOL_AVAILABLE_FROM, ...(overrides.tool_available_from || {}) },
    universalPowerUntil: overrides.universal_power_until !== undefined ? overrides.universal_power_until
                                                                       : DEFAULT_UNIVERSAL_POWER_UNTIL,
  };
}


// null when the tool is available in this year; otherwise the year it becomes available.
export function toolLockedUntil(rules, toolName, year) {
  const from = rules.toolAvailableFrom[toolName];
  return from !== undefined && from !== null && year < from ? from : null;
}


// A tool button reads "Police $500" when it can be built and "Police 1838" when it cannot: the year a student is
// waiting for is more use to them than a price they cannot pay yet.
export function toolDisplayName(label) {
  return label.split(' $')[0].trim();
}


export function lockedToolLabel(label, year) {
  return `${toolDisplayName(label)} ${year}`;
}


export function universalPowerIn(rules, year) {
  return rules.universalPowerUntil !== null && rules.universalPowerUntil !== undefined
    && year < rules.universalPowerUntil;
}
