/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Simulation tuning: the knobs a governance choice (or any other teaching-layer rule) may turn. The defaults
 * reproduce the unmodified engine exactly, so a city with default tuning plays like the original.
 *
 * Every knob is read by the engine through simData.tuning; nothing else in the engine should grow its own
 * teaching-layer switches.
 */

export const DEFAULT_TUNING = Object.freeze({
  // Multiplier on the taxes collected each January (Budget.collectTax).
  taxYield: 1,

  // Multiplier on how strongly the tax rate pushes RCI demand down (or up, at low rates) (Valves.setValves).
  taxGrowthDrag: 1,

  // Flat offsets added to each demand ratio every valve update, in valve units (Valves.setValves).
  resDemand: 0,
  comDemand: 0,
  indDemand: 0,

  // Multiplier on police coverage subtracted from crime (BlockMapUtils.crimeScan).
  policeEffectiveness: 1,

  // Flat offset added to every developed block's crime score before clamping (BlockMapUtils.crimeScan).
  crimePressure: 0,

  // When true, every conductive tile counts as powered, with or without plants and wires (PowerManager). Used for
  // eras before electrification, where zones grow without a power grid.
  universalPower: false,
});


export function makeTuning(overrides = {}) {
  const tuning = { ...DEFAULT_TUNING };

  for (const [key, value] of Object.entries(overrides)) {
    if (!(key in DEFAULT_TUNING))
      throw new Error(`Unknown tuning knob: ${key}`);

    if (typeof value !== typeof DEFAULT_TUNING[key] || (typeof value === 'number' && !Number.isFinite(value)))
      throw new Error(`Tuning knob ${key} must be a ${typeof DEFAULT_TUNING[key]}`);

    tuning[key] = value;
  }

  return tuning;
}
