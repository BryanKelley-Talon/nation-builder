#!/usr/bin/env python3
# Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
#
# GPL Section 7 additional terms: modified versions must be marked as such. Run this over any
# upstream micropolisJS file you change; it adds the Nation Builder modification line to the
# header comment once, and leaves files that already carry it alone.
#   python3 scripts/mark-modified.py src/game.js src/simulation.js ...
import sys

MARK = 'Modified for Nation Builder (Flashpoint History), 2026'
ANCHOR = 'as a courtesy of the owner.'

for path in sys.argv[1:]:
    text = open(path, encoding='utf-8').read()
    if MARK in text:
        continue
    lines = text.split('\n')
    for i, line in enumerate(lines[:40]):
        if ANCHOR in line:
            prefix = ' *' if line.lstrip().startswith('*') else '//'
            lines.insert(i + 1, f'{prefix}\n{prefix} {MARK} — see NOTICE.md.')
            break
    else:
        lines.insert(0, f'// {MARK} — see NOTICE.md.')
    open(path, 'w', encoding='utf-8').write('\n'.join(lines))
    print('marked', path)
