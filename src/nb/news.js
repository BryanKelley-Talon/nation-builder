/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * The town's news, in the advisor's voice. The engine already tells the player what its citizens want — "More
 * residential needed", "Crime very high" — in a one-line strip along the bottom of the map. This turns those same
 * events into a small newspaper vignette the advisor hands over: a masthead, a headline, and a line of counsel.
 *
 * Two things keep it from becoming noise. The engine repeats these messages every few seconds, so a newsroom hands
 * over at most one story a game year and will not run the same story twice within five. And when the citizens ask
 * for something their era does not have yet — a police station in 1800, electricity in 1850 — the advisor says so
 * instead of demanding the impossible, which is the same silence the tool buttons used to keep.
 *
 * Every word comes from content/ui/strings.json; this module decides which story, and when.
 */

import * as Messages from '../messages.ts';
import { toolLockedUntil } from './era.js';
import { fill } from './yearReview.js';

export const DEFAULT_EVERY_YEARS = 1;
export const DEFAULT_REPEAT_YEARS = 5;

// The engine's messages the advisor speaks to, each with the mechanic it teaches (kept for the desks, never shown to
// a student) and, where the citizens are asking for a thing, the tool that builds it — so an era-locked answer can be
// said plainly.
const STORIES = {
  [Messages.NEED_MORE_RESIDENTIAL]: { key: 'need_residential', mechanic: 'zone_placement' },
  [Messages.NEED_MORE_COMMERCIAL]: { key: 'need_commercial', mechanic: 'zone_placement' },
  [Messages.NEED_MORE_INDUSTRIAL]: { key: 'need_industrial', mechanic: 'zone_placement' },
  [Messages.NEED_MORE_ROADS]: { key: 'need_roads', mechanic: 'roads_rail', tool: 'road' },
  [Messages.NEED_MORE_RAILS]: { key: 'need_rails', mechanic: 'roads_rail', tool: 'rail' },
  [Messages.HEAVY_TRAFFIC]: { key: 'heavy_traffic', mechanic: 'roads_rail' },
  [Messages.NEED_ELECTRICITY]: { key: 'need_electricity', tool: 'coal' },
  [Messages.NOT_ENOUGH_POWER]: { key: 'need_electricity', tool: 'coal' },
  [Messages.BLACKOUTS_REPORTED]: { key: 'blackouts', tool: 'coal' },
  [Messages.NEED_POLICE_STATION]: { key: 'need_police', mechanic: 'governance_dial', tool: 'police' },
  [Messages.HIGH_CRIME]: { key: 'high_crime', mechanic: 'governance_dial' },
  [Messages.NEED_FIRE_STATION]: { key: 'need_fire', tool: 'fire' },
  [Messages.HIGH_POLLUTION]: { key: 'high_pollution', mechanic: 'zone_placement' },
  [Messages.NEED_STADIUM]: { key: 'need_stadium', tool: 'stadium' },
  [Messages.NEED_SEAPORT]: { key: 'need_seaport', tool: 'port' },
  [Messages.NEED_AIRPORT]: { key: 'need_airport', tool: 'airport' },
  [Messages.ROAD_NEEDS_FUNDING]: { key: 'roads_underfunded', mechanic: 'roads_rail' },
  [Messages.POLICE_NEEDS_FUNDING]: { key: 'police_underfunded', mechanic: 'governance_dial' },
  [Messages.FIRE_STATION_NEEDS_FUNDING]: { key: 'fire_underfunded' },
};


export function storyFor(subject) {
  return STORIES[subject] || null;
}


// Keeps the pace: one story a year at most, and no repeats of the same story within repeatYears.
export function makeNewsroom({ everyYears = DEFAULT_EVERY_YEARS, repeatYears = DEFAULT_REPEAT_YEARS } = {}) {
  let lastYearPrinted = null;
  const lastYearByKey = new Map();

  return {
    // Returns the story to print, or null to let the engine's own message strip carry it alone.
    consider(subject, year) {
      const story = storyFor(subject);
      if (!story)
        return null;

      if (lastYearPrinted !== null && year - lastYearPrinted < everyYears)
        return null;

      const printed = lastYearByKey.get(story.key);
      if (printed !== undefined && year - printed < repeatYears)
        return null;

      lastYearPrinted = year;
      lastYearByKey.set(story.key, year);
      return story;
    },
  };
}


// The vignette itself: what the paper says, and what the advisor says under it.
export function vignette({ story, strings, rules, townName, year }) {
  const words = strings.news;
  const item = words.items[story.key];
  if (!item)
    return null;

  const lockedUntil = story.tool && rules ? toolLockedUntil(rules, story.tool, year) : null;
  const counsel = lockedUntil !== null && item.not_yet
    ? fill(item.not_yet, { year: lockedUntil, town: townName })
    : fill(item.line, { town: townName, year });

  return {
    key: story.key,
    masthead: fill(words.masthead, { town: townName }),
    dateline: fill(words.dateline, { year }),
    headline: fill(item.headline, { town: townName, year }),
    counsel,
    byline: words.byline,
    // The mechanic the story teaches, for the desks and any teacher-facing view later. Never shown to a student:
    // internal skill-line codes do not belong on screen.
    mechanic: story.mechanic || null,
  };
}
