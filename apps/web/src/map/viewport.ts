/**
 * Room the map keeps around a framed area for the panels drawn over it. On a
 * phone the bottom sheet (height in the --sheet-h CSS variable, see
 * ui/mobile.tsx) and the navigation bar cover the bottom of the map, and the
 * map buttons its right edge.
 */
export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const isPhoneLayout = () => window.innerWidth <= 860;

/** Phone padding when a sheet is open above the navigation bar. */
export function phonePadding(): Padding {
  const sheet = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-h')) || window.innerHeight * 0.48;
  return { top: 64, bottom: Math.round(sheet + 56 + 12), left: 16, right: 64 };
}
