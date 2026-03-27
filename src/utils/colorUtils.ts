/**
 * Applies an alpha value to a hex color string.
 * @param color - Hex color string (3 or 6 chars, with #)
 * @param alpha - Alpha value between 0 and 1
 * @returns Hex color with alpha appended (e.g. '#1428a01a')
 */
export function withAlpha(color: string, alpha: number): string {
  // Expand 3-char hex to 6-char
  let hex = color.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');

  return `#${hex}${alphaHex}`;
}
