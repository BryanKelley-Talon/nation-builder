/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Loads content at runtime from content/, which ships as separate files beside the page (a separate work under its
 * own license), rather than bundling it into the GPL'd script.
 */

import { validateScenario } from './scenario.js';

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok)
    throw new Error(`Couldn't load ${path} (${response.status})`);
  return response.json();
}


// The leadership layers, one per course. BK's founding-door ruling (2026-09-20) makes the course the student
// founds under the switch for which vocabulary the game speaks from then on: Enduring Issues for Global, Civic
// Principles for US11R. The engine reads whichever layer the scenario's own `course` field names.
export const LEADERSHIP_COURSES = ['us11r', 'global10r'];


export async function loadContent() {
  const [index, strings] = await Promise.all([getJson('content/scenarios/index.json'), getJson('content/ui/strings.json')]);
  const scenarios = await Promise.all(index.scenarios.map(id => getJson(`content/scenarios/${id}.json`)));
  const layers = await Promise.all(LEADERSHIP_COURSES.map(course => getJson(`content/leadership/${course}.json`)));

  return {
    scenarios: scenarios.map(validateScenario),
    strings,
    leadership: Object.fromEntries(LEADERSHIP_COURSES.map((course, i) => [course, layers[i]])),
  };
}
