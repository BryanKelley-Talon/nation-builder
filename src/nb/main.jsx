/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Entry point for the teaching layer, called once the engine's tiles and sprites have loaded (src/micropolis.js).
 * It replaces the upstream splash screen.
 */

import { createRoot } from 'react-dom/client';

import { App } from './App.jsx';
import { loadContent } from './content.js';
import { startSession } from './session.js';
import { buildMap } from './terrain.js';
import './nb.css';


export async function startNationBuilder(assets) {
  const root = createRoot(document.getElementById('nb-root'));

  let content;
  try {
    content = await loadContent();
  } catch (e) {
    console.error(e);
    root.render(
      <div className="nb-overlay"><section className="nb-panel">
        <h1 className="nb-title">Nation Builder</h1>
        <p className="nb-error" role="alert">The game couldn’t load its scenarios. Reload the page to try again.</p>
      </section></div>);
    return;
  }

  // The in-game dialogs live in App; it binds their openers once it mounts.
  const dialogs = { save: () => {}, yearReview: () => {} };
  const bindDialogs = openers => Object.assign(dialogs, openers);
  const common = {
    assets,
    strings: content.strings,
    onSaveRequested: session => dialogs.save(session),
    onYearReview: (session, review) => dialogs.yearReview(session, review),
  };

  const onFound = ({ scenarioIndex, poleId, townName }) => {
    const scenario = content.scenarios[scenarioIndex];
    return startSession({ ...common, scenario, scenarioIndex, poleId, townName, map: buildMap(scenario.terrain) });
  };

  const onContinue = record => {
    const scenarioIndex = content.scenarios.findIndex(s => s.scenario_id === record.teaching.scenario_id);
    return startSession({
      ...common,
      scenario: content.scenarios[scenarioIndex],
      scenarioIndex,
      poleId: record.teaching.pole,
      savedCity: record.city,
      checkpoint: record.teaching.checkpoint,
    });
  };

  root.render(<App content={content} onFound={onFound} onContinue={onContinue} bindDialogs={bindDialogs} />);
}
