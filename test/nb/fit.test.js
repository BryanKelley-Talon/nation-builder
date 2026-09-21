/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

// Short windows shrink the side panels instead of refusing to run (BK's work laptop, 2026-09-21).

import { readFileSync } from 'node:fs';

import { DESIGN_HEIGHT, fitFactor } from '../../src/nb/fit.js';

describe('fitting the panels to a short window', () => {
  it('leaves a tall window alone', () => {
    expect(fitFactor(DESIGN_HEIGHT)).toBe(1);
    expect(fitFactor(1080)).toBe(1);
  });

  it('shrinks a short one in proportion, never below half size', () => {
    expect(fitFactor(540)).toBeCloseTo(540 / DESIGN_HEIGHT);
    expect(fitFactor(200)).toBe(0.5);
  });

  it('never scales the map canvas, so a click still lands on the tile under the pointer', () => {
    const css = readFileSync(new URL('../../public/css/chrome.css', import.meta.url), 'utf8');
    const rule = css.slice(css.indexOf('/* ---- Short windows'));
    expect(rule).toMatch(/zoom: var\(--nb-fit/);
    expect(rule).not.toMatch(/MicropolisCanvas|#canvasContainer|body\s*\{|html\s*\{/);
  });

  it('refuses only a window too short to read even shrunk', () => {
    const css = readFileSync(new URL('../../public/css/chrome.css', import.meta.url), 'utf8');
    expect(css).toMatch(/@media \(max-height: 582px\)\s*\{\s*#tooSmall\[data-hasscript=true\]\s*\{\s*display: none;/);
    expect(css).toMatch(/@media \(max-height: 399px\)/);
  });
});
