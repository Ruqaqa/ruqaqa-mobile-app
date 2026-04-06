import type { WatermarkDraft } from '../types';

/**
 * Pixel coordinates and opacity for rendering a watermark on an image.
 */
export interface WatermarkPixels {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

/**
 * Convert WatermarkDraft percentage values to absolute pixel coordinates
 * for a given image dimension and logo aspect ratio.
 *
 * @param draft          Watermark positioning in percentages (0–100).
 * @param imageWidth     Width of the target image in pixels.
 * @param imageHeight    Height of the target image in pixels.
 * @param logoAspectRatio  Logo width / logo height (e.g. 2.0 for a 2:1 logo).
 * @returns Pixel coordinates and opacity (0.0–1.0) for rendering.
 */
export function computeWatermarkPixels(
  draft: WatermarkDraft,
  imageWidth: number,
  imageHeight: number,
  logoAspectRatio: number,
): WatermarkPixels {
  const x = Math.round((draft.xPct / 100) * imageWidth);
  const y = Math.round((draft.yPct / 100) * imageHeight);
  const width = Math.round((draft.widthPct / 100) * imageWidth);
  const height = Math.round(width / logoAspectRatio);
  const opacity = draft.opacityPct / 100;

  return { x, y, width, height, opacity };
}
