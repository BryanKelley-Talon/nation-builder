# NOTICE — Nation Builder is a modified version of micropolisJS

**This is not the original program.** Nation Builder is a modified version of
[micropolisJS](https://github.com/graememcc/micropolisJS) by Graeme McCutcheon
and contributors (itself adapted from the Micropolis source release), forked at
upstream commit `f13a162` on 2026-09-19. Upstream history is preserved in this
repository's git log.

- **Code license:** GNU GPL v3 with the Section 7 additional terms in `LICENSE`
  (full GPL text in `COPYING`). Both apply to this whole repository's code,
  including any Flashpoint template code merged in.
- **Content license:** everything under `content/` is a separate work under its
  own license — see `content/LICENSE.md`. No file mixes the two.
- **Trademarks:** Nation Builder does not use the SimCity trademark and claims no
  affiliation with Electronic Arts. Micropolis is a registered trademark of
  Micropolis Corporation (Micropolis GmbH) and is licensed here as a courtesy of
  the owner under the Micropolis Public Name License
  (`MicropolisPublicNameLicense.md`, https://www.micropolis.com).

## How modifications are marked

- Every upstream source file we change carries a line in its header comment:
  `Modified for Nation Builder (Flashpoint History), 2026 — see NOTICE.md.`
- New files written for Nation Builder carry a Nation Builder header instead.
- The change log below lists modifications by area. `git log` is the full record.

## Modifications

- **Build:** webpack/jest replaced with Vite/Vitest.
- **Chrome:** product name changed to Nation Builder; Twitter widget removed;
  Flashpoint palette and type applied to the page chrome; about page rewritten.
- **Port bug fixes** (bugs in micropolisJS, not in the 1989 original):
  crime scan never ran; police/fire underfunding constants misnamed; census
  money history read an undeclared `budget`; hospital demand read an undefined
  field; shrinking-city score scale floored to -1; `_updateTime` rollover called
  an undefined function.
- **Engine seams for the teaching layer:** configurable start year and funds
  (saved with the city), a year-end event, an exported tuning object for
  governance modifiers, tool availability gating by year.
- **Teaching layer:** scenario loader, governance choice, save code and save file.
