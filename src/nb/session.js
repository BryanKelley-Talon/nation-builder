/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * A session binds one running Game to its teaching-layer state: scenario, governance pole, era rules, save code,
 * checkpoints. The engine's event listeners are shared per class and never removed, so there is exactly one Game
 * per page load; starting another city reloads the page.
 */

import $ from 'jquery';

import { Game } from '../game.js';
import * as Messages from '../messages.ts';
import { eraRules, lockedToolLabel, toolDisplayName, toolLockedUntil, universalPowerIn } from './era.js';
import { encodeSaveCode } from './saveCode.js';
import { makeSaveRecord } from './saveFile.js';
import { applyStartingPressures, simOptionsFor, skillLabel } from './scenario.js';
import { makeNewsroom, vignette } from './news.js';
import { footprintTouchesWater } from './terrain.js';
import { classRank, fill, yearReview } from './yearReview.js';

const AUTOSAVE_KEY = 'nationBuilderAutosave';

// A scenario may set its own pace for the advisor's news: news_rules.every_years, news_rules.repeat_years.
function newsPace(scenario) {
  const rules = (scenario && scenario.news_rules) || {};
  return {
    ...(Number.isInteger(rules.every_years) && rules.every_years > 0 ? { everyYears: rules.every_years } : {}),
    ...(Number.isInteger(rules.repeat_years) && rules.repeat_years > 0 ? { repeatYears: rules.repeat_years } : {}),
  };
}

const REVIEW_RETRY_MS = 250;


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


// ctx: {assets, scenario, scenarioIndex, poleId, strings, onSaveRequested, onYearReview, onNews,
//       map + townName (new city) or savedCity + checkpoint + lastReview + highestClass (continuing)}
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
  // The last year-end panel the student saw, so the next one measures the whole span since it. A city resumed from
  // a save made before this existed falls back to its checkpoint.
  let lastReview = ctx.lastReview || ctx.checkpoint || null;
  // The largest the town has ever been: growing into a new class stops play, sliding back and forth doesn't.
  let highestClass = ctx.highestClass || (ctx.checkpoint && ctx.checkpoint.cityClass) || null;

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
        last_review: lastReview,
        highest_class: highestClass,
      }, game.saveData());
    },
  };

  // Era rules: tools appear when their year arrives; the grid becomes necessary after universal power ends.
  let poweredByEra = sim.tuning.universalPower;

  // A locked tool stays clickable. Disabling the button swallowed the click and told the student nothing: the year
  // they were waiting for was in a hover tooltip they had no reason to look for, so the game read as broken.
  function applyEra(year) {
    $('.toolButton').each(function() {
      const button = $(this);
      if (button.attr('data-label') === undefined)
        button.attr('data-label', button.text());

      const label = button.attr('data-label');
      const lockedUntil = toolLockedUntil(rules, button.attr('data-tool'), year);
      button.prop('disabled', false)
            .toggleClass('nbLocked', lockedUntil !== null)
            .attr('aria-disabled', lockedUntil !== null ? 'true' : null)
            .attr('title', lockedUntil !== null ? lockedToolMessage(label, lockedUntil) : null)
            .text(lockedUntil !== null ? lockedToolLabel(label, lockedUntil) : label);
    });

    const universal = universalPowerIn(rules, year);
    if (universal !== poweredByEra) {
      poweredByEra = universal;
      sim.setTuning({ ...poleTuning, universalPower: universal });
      if (!universal)
        game._notificationBar.badNews({ subject: Messages.NEED_ELECTRICITY });
    }
  }

  function lockedToolMessage(label, year) {
    return `${fill(strings.era.tool_locked, { tool: toolDisplayName(label), year })} ` +
           `${fill(strings.era.tool_locked_hint, { year: session.year() })}`;
  }

  applyEra(session.year());
  sim.addEventListener(Messages.DATE_UPDATED, date => applyEra(date.year));

  // Said where the student is looking, before the engine's own click handler can select the tool. The listener
  // takes the capture phase because upstream binds tool selection on the button itself.
  document.getElementById('controls').addEventListener('click', event => {
    const button = event.target.closest('.toolButton');
    if (!button)
      return;

    const lockedUntil = toolLockedUntil(rules, button.getAttribute('data-tool'), session.year());
    if (lockedUntil === null)
      return;

    event.stopPropagation();
    event.preventDefault();
    $('#toolOutput').text(lockedToolMessage(button.getAttribute('data-label'), lockedUntil));
  }, true);

  game.toolGuard = toolName => {
    const lockedUntil = toolLockedUntil(rules, toolName, session.year());
    if (lockedUntil === null)
      return null;
    const button = document.querySelector(`.toolButton[data-tool="${toolName}"]`);
    return lockedToolMessage(button ? button.getAttribute('data-label') : toolName, lockedUntil);
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

  // Checkpoints: every year-end snapshot updates the code, and an autosave on this computer. Then the year in review,
  // once any window the engine opened at the same moment (the mandatory budget, a city-class congratulation) closes.
  sim.addEventListener(Messages.YEAR_ENDED, snapshot => {
    const review = yearReview({ previous: lastReview, snapshot, scenario, poleId, strings, townName: game.name,
                                highestClass });
    lastCheckpoint = snapshot;
    if (classRank(snapshot.cityClass) > classRank(highestClass))
      highestClass = snapshot.cityClass;
    if (review)
      lastReview = snapshot;
    writeAutosave(session.saveRecord());

    if (review && ctx.onYearReview) {
      const show = () => game.dialogOpen ? window.setTimeout(show, REVIEW_RETRY_MS) : ctx.onYearReview(session, review);
      show();
    }
  });

  // The town's news: the engine's own citizen-need messages, handed over in the advisor's voice. The newsroom keeps
  // the pace; the engine's message strip still carries everything, including the stories the newsroom holds back.
  const newsroom = makeNewsroom(newsPace(scenario));

  sim.addEventListener(Messages.FRONT_END_MESSAGE, message => {
    if (!ctx.onNews)
      return;

    const year = session.year();
    const story = newsroom.consider(message.subject, year);
    if (!story)
      return;

    const printed = vignette({ story, strings, scenario, rules, townName: game.name, year, skillLabel });
    if (printed)
      ctx.onNews(printed);
  });

  game.onSaveRequested = () => ctx.onSaveRequested(session);
  $('#saveRequest').prop('disabled', false);

  return session;
}
