# NOTICE — Nation Builder is a modified version of micropolisJS

**This is not the original program.** Nation Builder is a modified version of
[micropolisJS](https://github.com/graememcc/micropolisJS) by Graeme McCutcheon
and contributors (itself adapted from the Micropolis source release), forked at
upstream commit `f13a162` on 2026-09-19. Upstream history is preserved in this
repository's git log.

- **Source:** the complete corresponding source for this program, including this
  modified version's own history, is at https://github.com/BryanKelley-Talon/nation-builder.
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
- **Chrome:** product name changed to Nation Builder; Twitter widget and the
  half-hour donation nag removed; about page and footer credits rewritten;
  upstream splash screen replaced by the teaching layer's opening screens.
- **Port bug fixes** (bugs in micropolisJS, not in the 1989 original):
  crime scan never ran; police/fire underfunding constants misnamed; census
  money history read an undeclared `budget`; hospital demand read an undefined
  field; shrinking-city score scale floored to -1; `_updateTime` rollover called
  an undefined function; auto-bulldoze setting did not load; evaluation's
  problem list grew every year; heavy-traffic message shared another message's
  name; the snow tileset was read from the wrong element and so never loaded
  from its own image.
- **Performance:** the sim tick no longer queries layout on every tick; tiles
  are drawn straight from the tileset image instead of being cut into 1,024
  separate images at startup, which also removes the two base64 copies of the
  tilesets the old method needed as a fallback.
- **Engine seams for the teaching layer:** configurable start year and funds
  (saved with the city), a year-end event, an exported tuning object for
  governance modifiers, hooks in `Game` for tool refusal, tool feedback, saving
  and teaching-layer dialogs.
- **Teaching layer (new code, `src/nb/`):** scenario loader, terrain loader,
  era tool gating, governance choice, save code, city file, session wiring,
  the year-in-review panel and screens.
