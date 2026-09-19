/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Era rules: which tools exist in a given year, and whether the city runs without an electric grid. The tile art
 * stays 20th-century whatever the year (ruling 2026-09-19); gating availability is the cheap, honest part.
 *
 * The years below are defaults for review, not settled content. A scenario may override any of them with
 * era_rules.tool_available_from and era_rules.universal_power_until.
 */

export const DEFAULT_TOOL_AVAILABLE_FROM = Object.freeze({
  rail: 1830,      // Baltimore & Ohio begins scheduled rail service
  police: 1838,    // Boston forms the first US municipal police department
  coal: 1882,      // Pearl Street Station, New York: first central power plant
  wire: 1882,
  stadium: 1903,   // Harvard Stadium, first large reinforced-concrete stadium in the US
  airport: 1909,   // College Park Airport, Maryland
  nuclear: 1957,   // Shippingport, Pennsylvania: first US commercial nuclear plant
});

// Until this year every zone counts as powered (water wheels, wood, coal stoves: no grid to build). After it, zones
// need plants and wires like the original game.
export const DEFAULT_UNIVERSAL_POWER_UNTIL = 1900;


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


export function universalPowerIn(rules, year) {
  return year < rules.universalPowerUntil;
}
