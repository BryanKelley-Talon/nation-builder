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
import { applyStartingPressures, simOptionsFor } from './scenario.js';
import { changeOfGovernment, nextClue, successionVignette } from './clues.js';
import { findChoice, recordDecision, resolve } from './decisions.js';
import { currentTuning } from './governance.js';
import { advance, fromSave, leaderById, leadershipRules, leaderVoice, startingState, toSave } from './leadership.js';
import { makeNewsroom, vignette } from './news.js';
import { nextUnrest, unrestWeights } from './unrest.js';
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


// ctx: {assets, scenario, scenarioIndex, poleId, strings, leadership, onSaveRequested, onYearReview, onNews,
//       map + townName (new city) or savedCity + checkpoint + lastReview + highestClass (continuing)}
export function startSession(ctx) {
  const { assets, scenario, scenarioIndex, poleId, strings } = ctx;
  const era = eraRules(scenario);
  const poleIds = Object.keys(scenario.governance_poles);
  const poleTuning = (scenario.governance_poles[poleId] && scenario.governance_poles[poleId].tuning) || {};

  let game;
  if (ctx.savedCity) {
    const city = { ...ctx.savedCity, isSavedGame: true };
    game = new Game(city, assets.tileSet, assets.snowTileSet, assets.spriteSheet, city._gameLevel || 0, city.name);
  } else {
    const startYear = scenario.start_year;
    const options = simOptionsFor(scenario, poleId, { universalPower: universalPowerIn(era, startYear) });
    game = new Game(ctx.map, assets.tileSet, assets.snowTileSet, assets.spriteSheet, 0, ctx.townName, options);
    applyStartingPressures(scenario, game.simulation);
  }

  // Leadership: one architecture, the content layer chosen by the scenario's own course (BK's founding-door
  // ruling). A scenario with no layer for its course simply has no leadership, and everything else still runs.
  const layer = (ctx.leadership && ctx.leadership[scenario.course]) || null;
  const rules = leadershipRules(layer || {});
  const weights = unrestWeights(scenario);

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

    // Who is in office, in the words this year uses. Null for a scenario with no leadership layer.
    leader() {
      if (!leadership)
        return null;
      const leader = leaderById(rules, leadership.leader);
      return leader ? { id: leader.id, ...leaderVoice(leader, sim.getDate().year) } : null;
    },

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

    decide,

    code() {
      const c = session.checkpoint();
      return encodeSaveCode({
        scenarioIndex,
        poleIndex: poleIds.indexOf(poleId),
        advisorBits: decisionBits,
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
        advisor_bits: decisionBits,
        decision_bends: decisionBends,
        code,
        checkpoint: session.checkpoint(),
        last_review: lastReview,
        highest_class: highestClass,
        leadership: toSave(leadership),
        clue_state: clueState,
      }, game.saveData());
    },
  };

  // Who governs, and the town's mood. A leader bends the founding choice; governance.js is where that is made
  // mechanical, and every tuning change in this file goes through it.
  let leadership = layer
    ? (ctx.leadership_state ? fromSave(ctx.leadership_state, rules, session.year()) : startingState(rules, session.year()))
    : null;
  let clueState = ctx.clue_state || {};
  let decisionBits = ctx.advisor_bits || 0;
  // The knobs the student's own decisions have bent, carried between years and into the save.
  let decisionBends = ctx.decision_bends || {};
  let decisionMilitarism = 0;

  function leaderBends() {
    if (!leadership)
      return {};

    const leader = leaderById(rules, leadership.leader);
    if (!leader)
      return {};

    const voice = leaderVoice(leader, session.year());
    const byEra = (leader.by_era || []).find(entry => entry.id === voice.era);
    return { ...(leader.tuning || {}), ...((byEra && byEra.tuning) || {}), ...decisionBends };
  }


  // An answer to the advisor. The card stays on screen until this runs, and the town feels it the same year.
  function decide(ladderKey, choiceId) {
    const ladder = (layer && (layer.ladders || []).find(entry => entry.key === ladderKey)) || null;
    const choice = findChoice(ladder, choiceId);
    if (!choice)
      return null;

    const outcome = resolve({
      choice,
      funds: sim.budget.totalFunds,
      tuning: currentTuning({ pole: poleTuning, leader: leaderBends() }),
      militarism: decisionMilitarism,
    });

    if (outcome.paid)
      sim.budget.spend(outcome.paid);
    if (outcome.tax)
      sim.budget.setTax(Math.max(0, Math.min(20, sim.budget.cityTax + outcome.tax)));

    decisionMilitarism = outcome.militarism;
    decisionBends = { ...decisionBends, ...(choice.effect && choice.effect.tuning ? choice.effect.tuning : {}) };
    decisionBits = recordDecision(decisionBits, choice);

    if (leadership)
      leadership = { ...leadership, unrest: Math.max(0, Math.min(100, leadership.unrest + outcome.unrest)) };

    applyTuning(session.year());
    writeAutosave(session.saveRecord());
    return outcome;
  }

  function applyTuning(year) {
    sim.setTuning(currentTuning({
      pole: poleTuning,
      leader: leaderBends(),
      era: { universalPower: universalPowerIn(era, year) },
    }));
  }

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
      const lockedUntil = toolLockedUntil(era, button.attr('data-tool'), year);
      button.prop('disabled', false)
            .toggleClass('nbLocked', lockedUntil !== null)
            .attr('aria-disabled', lockedUntil !== null ? 'true' : null)
            .attr('title', lockedUntil !== null ? lockedToolMessage(label, lockedUntil) : null)
            .text(lockedUntil !== null ? lockedToolLabel(label, lockedUntil) : label);
    });

    const universal = universalPowerIn(era, year);
    if (universal !== poweredByEra) {
      poweredByEra = universal;
      applyTuning(year);
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

    const lockedUntil = toolLockedUntil(era, button.getAttribute('data-tool'), session.year());
    if (lockedUntil === null)
      return;

    event.stopPropagation();
    event.preventDefault();
    $('#toolOutput').text(lockedToolMessage(button.getAttribute('data-label'), lockedUntil));
  }, true);

  game.toolGuard = toolName => {
    const lockedUntil = toolLockedUntil(era, toolName, session.year());
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
      ? strings.terrain_water_refused
      : null;
  };

  // One year of governing: the town's mood, the advisor's line about it, and — when it comes to it — a change of
  // government. Returns whatever the year in review and the news should carry.
  function governYear(snapshot) {
    if (!leadership)
      return { change: null };

    const year = snapshot.year;
    const leader = leaderById(rules, leadership.leader);
    // Read before advance(): once it returns, `leadership` is the new government and `since` is this year.
    const governedSince = leadership.since;
    const militarism = (leader && leader.disposition && leader.disposition.militarism) || 0;
    const reading = nextUnrest({ snapshot, previous: leadership.unrest, militarism, weights });

    const outcome = advance({ rules, state: leadership, year, unrest: reading.value, dominant: reading.dominant });
    leadership = outcome.state;

    if (outcome.event) {
      // A new government bends the pole its own way from the year it takes office.
      applyTuning(year);
      clueState = {};

      const outgoing = { id: outcome.from.id, ...leaderVoice(outcome.from, year) };
      const incoming = { id: outcome.to.id, ...leaderVoice(outcome.to, year) };

      if (ctx.onNews)
        ctx.onNews(successionVignette({ strings, townName: game.name, year, event: outcome.event, outgoing, incoming }));

      return {
        change: changeOfGovernment({ strings, event: outcome.event, outgoing, incoming, year,
                                     since: governedSince, sustainedYears: rules.sustainedYears,
                                     dominant: reading.dominant, layer }),
      };
    }

    // No change this year: the advisor may still have something to say about where it is heading.
    const clue = nextClue({ layer, dominant: reading.dominant, leader, unrestValue: reading.value, year,
                            state: clueState });
    if (clue && ctx.onNews) {
      clueState = clue.state;
      ctx.onNews({
        key: `clue:${clue.key}`,
        masthead: fill(strings.leadership.advisor_masthead, {}),
        dateline: String(year),
        headline: '',
        counsel: clue.line,
        byline: strings.news.byline,
        mechanic: 'advisor_conflict',
        // An advisor card is answered, not dismissed.
        ladder: clue.key,
        choices: clue.choices,
      });
    }

    return { change: null };
  }


  // Checkpoints: every year-end snapshot updates the code, and an autosave on this computer. Then the year in review,
  // once any window the engine opened at the same moment (the mandatory budget, a city-class congratulation) closes.
  sim.addEventListener(Messages.YEAR_ENDED, snapshot => {
    // The town's mood, and which pressure is driving it: both desks' advisor material keys off the dominant term.
    const government = governYear(snapshot);

    const review = yearReview({ previous: lastReview, snapshot, scenario, poleId, strings, townName: game.name,
                                highestClass, government: government.change });
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

    const printed = vignette({ story, strings, rules: era, townName: game.name, year });
    if (printed)
      ctx.onNews(printed);
  });

  // Moving the map. The engine answers only to the arrow keys, which a student has no reason to discover, and the
  // map (120 x 100 tiles) is nearly three times the size of a Chromebook's window — so most of the town is off
  // screen with no obvious way to reach it. Two-finger scroll pans it, and so does dragging with the middle or
  // right button; the arrow keys still work. Nothing here touches the engine: it drives the canvas's own moves.
  const mapCanvas = document.getElementById('MicropolisCanvas');
  const TILE = assets.tileSet.tileWidth || 16;

  function pan(tilesX, tilesY) {
    const view = game.gameCanvas;
    for (let i = 0; i < Math.abs(tilesX); i++)
      tilesX > 0 ? view.moveEast() : view.moveWest();
    for (let i = 0; i < Math.abs(tilesY); i++)
      tilesY > 0 ? view.moveSouth() : view.moveNorth();
  }

  if (mapCanvas) {
    let scrolledX = 0;
    let scrolledY = 0;

    mapCanvas.addEventListener('wheel', event => {
      if (game.dialogOpen)
        return;

      event.preventDefault();
      // Some browsers report scrolling in lines rather than pixels.
      const scale = event.deltaMode === 1 ? TILE : 1;
      scrolledX += event.deltaX * scale;
      scrolledY += event.deltaY * scale;

      const tilesX = Math.trunc(scrolledX / TILE);
      const tilesY = Math.trunc(scrolledY / TILE);
      scrolledX -= tilesX * TILE;
      scrolledY -= tilesY * TILE;
      if (tilesX || tilesY)
        pan(tilesX, tilesY);
    }, { passive: false });

    // Drag with a button the tools do not use, so building still works the way it did.
    let dragFrom = null;
    mapCanvas.addEventListener('mousedown', event => {
      if (event.button === 1 || event.button === 2) {
        dragFrom = { x: event.clientX, y: event.clientY };
        event.preventDefault();
      }
    });

    mapCanvas.addEventListener('contextmenu', event => {
      if (dragFrom)
        event.preventDefault();
    });

    window.addEventListener('mousemove', event => {
      if (!dragFrom || game.dialogOpen)
        return;

      // The map follows the hand: drag right, the view moves west.
      const tilesX = Math.trunc((dragFrom.x - event.clientX) / TILE);
      const tilesY = Math.trunc((dragFrom.y - event.clientY) / TILE);
      if (tilesX || tilesY) {
        pan(tilesX, tilesY);
        dragFrom = { x: dragFrom.x - tilesX * TILE, y: dragFrom.y - tilesY * TILE };
      }
    });

    window.addEventListener('mouseup', () => { dragFrom = null; });
  }

  game.onSaveRequested = () => ctx.onSaveRequested(session);
  $('#saveRequest').prop('disabled', false);

  return session;
}
