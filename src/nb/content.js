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


export async function loadContent() {
  const [index, strings] = await Promise.all([getJson('content/scenarios/index.json'), getJson('content/ui/strings.json')]);
  const scenarios = await Promise.all(index.scenarios.map(id => getJson(`content/scenarios/${id}.json`)));
  return { scenarios: scenarios.map(validateScenario), strings };
}
