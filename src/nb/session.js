/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * A session binds one running Game to its teaching-layer state: scenario, governance pole, era rules, save code,
 * checkpoints. The engine's event listeners are shared per class and never removed, so there is exactly one Game
 * per page load; starting another city reloads the page.
 */

import $ from 'jquery';

import { Game } from '../game.js';
import * as Messages from '../messages.ts';
import { eraRules, toolLockedUntil, universalPowerIn } from './era.js';
import { encodeSaveCode } from './saveCode.js';
import { makeSaveRecord } from './saveFile.js';
import { applyStartingPressures, simOptionsFor, skillLabel } from './scenario.js';
import { footprintTouchesWater } from './terrain.js';

const AUTOSAVE_KEY = 'nationBuilderAutosave';


// A convenience copy on this computer, never the only copy: shared and managed Chromebooks wipe it.
export function readAutosave() {
  try {
    const raw = window.localStorage.getItem(AUTOSAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}


function writeAutosave(record) {
  try {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(record));
  } catch (e) {
    // Storage full, blocked or unavailable: the city file is the real save, so carry on.
  }
}


// ctx: {assets, scenario, scenarioIndex, poleId, strings, onSaveRequested,
//       map + townName (new city) or savedCity + checkpoint (continuing)}
export function startSession(ctx) {
  const { assets, scenario, scenarioIndex, poleId, strings } = ctx;
  const rules = eraRules(scenario);
  const poleIds = Object.keys(scenario.governance_poles);
  const poleTuning = (scenario.governance_poles[poleId] && scenario.governance_poles[poleId].tuning) || {};

  let game;
  if (ctx.savedCity) {
    const city = { ...ctx.savedCity, isSavedGame: true };
    game = new Game(city, assets.tileSet, assets.snowTileSet, assets.spriteSheet, city._gameLevel || 0, city.name);
  } else {
    const startYear = scenario.start_year;
    const options = simOptionsFor(scenario, poleId, { universalPower: universalPowerIn(rules, startYear) });
    game = new Game(ctx.map, assets.tileSet, assets.snowTileSet, assets.spriteSheet, 0, ctx.townName, options);
    applyStartingPressures(scenario, game.simulation);
  }

  const sim = game.simulation;
  let lastCheckpoint = ctx.checkpoint || null;

  const session = {
    game,
    scenario,
    poleId,
    townName: game.name,

    year: () => sim.getDate().year,

    // Headline state for the save code: the latest year-end snapshot, or the live numbers before the first one.
    checkpoint() {
      return lastCheckpoint || {
        year: sim.getDate().year,
        population: sim.evaluation.cityPop,
        score: sim.evaluation.cityScore,
        funds: sim.budget.totalFunds,
        approval: sim.evaluation.cityYes,
      };
    },

    code() {
      const c = session.checkpoint();
      return encodeSaveCode({
        scenarioIndex,
        poleIndex: poleIds.indexOf(poleId),
        advisorBits: 0,
        year: c.year,
        population: c.population,
        score: c.score,
        funds: c.funds,
        approval: c.approval,
      });
    },

    saveRecord() {
      const code = session.code();
      return makeSaveRecord({
        scenario_id: scenario.scenario_id,
        scenario_index: scenarioIndex,
        pole: poleId,
        town_name: game.name,
        advisor_bits: 0,
        code,
        checkpoint: session.checkpoint(),
      }, game.saveData());
    },
  };

  // Era rules: tools appear when their year arrives; the grid becomes necessary after universal power ends.
  let poweredByEra = sim.tuning.universalPower;

  function applyEra(year) {
    $('.toolButton').each(function() {
      const lockedUntil = toolLockedUntil(rules, $(this).attr('data-tool'), year);
      $(this).prop('disabled', lockedUntil !== null)
             .toggleClass('nbLocked', lockedUntil !== null)
             .attr('title', lockedUntil !== null ? `Available from ${lockedUntil}` : '');
    });

    const universal = universalPowerIn(rules, year);
    if (universal !== poweredByEra) {
      poweredByEra = universal;
      sim.setTuning({ ...poleTuning, universalPower: universal });
      if (!universal)
        game._notificationBar.badNews({ subject: Messages.NEED_ELECTRICITY });
    }
  }

  applyEra(session.year());
  sim.addEventListener(Messages.DATE_UPDATED, date => applyEra(date.year));

  game.toolGuard = toolName => {
    const lockedUntil = toolLockedUntil(rules, toolName, session.year());
    return lockedUntil === null ? null : `Not available until ${lockedUntil}`;
  };

  // Terrain-driven placement: when water blocks a zone or building, say so (upstream says "bulldoze first", which
  // the bulldozer can't do on open water), labelled with the scenario's skill line. Roads, rail and wire bridge
  // water on their own, so only sized buildings are checked.
  game.onToolResult = (toolName, result, tile) => {
    const tool = game.inputStatus.currentTool;
    if (result === tool.TOOLRESULT_OK || result === tool.TOOLRESULT_NO_MONEY || !tool.size)
      return null;
    return footprintTouchesWater(game.gameMap, tile.x - 1, tile.y - 1, tool.size)
      ? `${skillLabel(scenario, 'terrain_placement')} · ${strings.terrain_water_refused}`
      : null;
  };

  // Checkpoints: every year-end snapshot updates the code, and an autosave on this computer.
  sim.addEventListener(Messages.YEAR_ENDED, snapshot => {
    lastCheckpoint = snapshot;
    writeAutosave(session.saveRecord());
  });

  game.onSaveRequested = () => ctx.onSaveRequested(session);
  $('#saveRequest').prop('disabled', false);

  return session;
}
