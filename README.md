# Nation Builder

A history and civics city-building simulation from Flashpoint History. Students found
a town in a historical year, choose once how it is governed, and live with that choice
as the city grows. Free, no accounts, nothing about the student leaves their computer.

**This is a modified version of [micropolisJS](https://github.com/graememcc/micropolisJS)**
(Graeme McCutcheon's port of Micropolis), not the original program. See `NOTICE.md`
for what changed and `README-upstream.md` for the original readme.

- Code: GNU GPL v3 with Section 7 additional terms (`LICENSE`, `COPYING`).
- Content under `content/`: a separate work, CC BY-NC-SA 4.0 (`content/LICENSE.md`).
- Micropolis is a registered trademark of Micropolis Corporation (Micropolis GmbH) and is
  licensed here as a courtesy of the owner under the Micropolis Public Name License
  (`MicropolisPublicNameLicense.md`, https://www.micropolis.com). Never use "Micropolis"
  or "SimCity" in product names, domains or marketing.

## Commands

Needs Node 20 or newer (`.nvmrc` says 24). On the Flashpoint Mac the `node` first on
PATH is v11; run `export PATH=/usr/local/bin:$PATH` first.

```
npm install
npm run dev      # local preview
npm test         # unit tests + headless simulation tests
npm run build    # -> dist/ (page, license texts, content/)
```

Build local only. Nothing here deploys; BK reviews before anything goes live.

## Layout

| Path | What it is |
|---|---|
| `src/*.js`, `src/*.ts` | The engine and its original UI chrome, from micropolisJS. Files we changed say so in their header. |
| `src/tuning.js` | The knobs a governance choice may turn. Defaults reproduce the unmodified engine. |
| `src/nb/` | The teaching layer: scenario contract, terrain loader, era rules, save code, city file, session, React screens. |
| `content/` | Scenarios and student-facing text, fetched at runtime. `scenarios/index.json` fixes each scenario's number in save codes: append only. |
| `test/*.ts` | Upstream unit tests. |
| `test/sim/` | Headless simulation harness (`harness.js`) and engine tests. |
| `test/nb/` | Teaching-layer tests. |
| `scripts/mark-modified.py` | Stamps changed upstream files with the modification notice (GPL s7). Run it on every upstream file you touch. |
| `scripts/make-dev-fixture.mjs` | Regenerates the dev-fixture scenario. |

## Writing a scenario

A scenario is one JSON file in `content/scenarios/`, validated by `src/nb/scenario.js`
(`validateScenario`); the dev fixture is a complete example. Terrain is a 120 × 100
character grid (`rows-v1`: land, water, trees). Every mechanic's skill-line label comes
from `skill_line_map`; the code never hardcodes one. A governance pole set to `null` is a
reserved slot, shown to students as "coming later".

The dev fixture (`dev-fixture-us11r.json`) is placeholder data for building against. It
is not curriculum content.

## Saving

Students keep their own city: the Save button shows a 14-character code to copy onto the
worksheet and saves a `.nbcity` file (gzip JSON, a few KB) they put in Google Drive.
Continue opens that file, a convenience copy autosaved on the same computer each game
year, or, if the file is lost, restarts from the code with the same government.

## Engine notes

- The engine's event listeners are shared per class and never removed: one `Game` per
  page load. Starting another city reloads the page.
- `test/sim/harness.js` runs the simulation without a DOM or clock:
  `runYears(sim, n)` is 768 simulation phases per year.
