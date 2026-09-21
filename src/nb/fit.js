/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md.
 *
 * Short windows: shrink the side panels rather than refuse to run. See the "Short windows" block in
 * public/css/chrome.css for why. The panels' fixed positions assume a window at least this tall; below it, they are
 * scaled by the ratio so the lowest of them still ends inside the window.
 */

export const DESIGN_HEIGHT = 700;


export function fitFactor(height) {
  return Math.min(1, Math.max(0.5, height / DESIGN_HEIGHT));
}


export function fitPanelsToWindow() {
  const apply = () => document.documentElement.style.setProperty('--nb-fit', String(fitFactor(window.innerHeight)));
  apply();
  window.addEventListener('resize', apply);
}
