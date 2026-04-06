import type { WatermarkDraft } from '../types';
import { DEFAULT_WATERMARK_DRAFT } from '../types';
import { computeWatermarkPixels } from '../utils/watermarkCoordinates';

/**
 * computeWatermarkPixels converts WatermarkDraft percentage values to
 * absolute pixel coordinates for a given image dimension.
 *
 * Expected output shape:
 *   { x: number, y: number, width: number, height: number, opacity: number }
 *
 * - x = (xPct / 100) * imageWidth
 * - y = (yPct / 100) * imageHeight
 * - width = (widthPct / 100) * imageWidth
 * - height = width / logoAspectRatio
 * - opacity = opacityPct / 100
 */

// --- Helpers ---

const LOGO_ASPECT_RATIO = 2; // logo is 2:1 (width:height)

function makeDraft(overrides: Partial<WatermarkDraft> = {}): WatermarkDraft {
  return { ...DEFAULT_WATERMARK_DRAFT, ...overrides };
}

// --- Tests ---

describe('computeWatermarkPixels', () => {
  // --- Basic conversion ---

  it('converts default draft to pixels on 1920x1080 image', () => {
    const result = computeWatermarkPixels(
      makeDraft(), // xPct=40, yPct=40, widthPct=20, opacityPct=50
      1920,
      1080,
      LOGO_ASPECT_RATIO,
    );

    expect(result.x).toBe(768);        // 40% of 1920
    expect(result.y).toBe(432);        // 40% of 1080
    expect(result.width).toBe(384);    // 20% of 1920
    expect(result.height).toBe(192);   // 384 / 2 (aspect ratio)
    expect(result.opacity).toBe(0.5);  // 50%
  });

  it('converts 50% position on 1000x1000 square image', () => {
    const result = computeWatermarkPixels(
      makeDraft({ xPct: 50, yPct: 50, widthPct: 10, opacityPct: 100 }),
      1000,
      1000,
      LOGO_ASPECT_RATIO,
    );

    expect(result.x).toBe(500);
    expect(result.y).toBe(500);
    expect(result.width).toBe(100);    // 10% of 1000
    expect(result.height).toBe(50);    // 100 / 2
    expect(result.opacity).toBe(1.0);
  });

  // --- Corner positions ---

  it('positions at top-left corner (0%, 0%)', () => {
    const result = computeWatermarkPixels(
      makeDraft({ xPct: 0, yPct: 0 }),
      1920,
      1080,
      LOGO_ASPECT_RATIO,
    );

    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('positions at bottom-right corner (100%, 100%)', () => {
    const result = computeWatermarkPixels(
      makeDraft({ xPct: 100, yPct: 100 }),
      1920,
      1080,
      LOGO_ASPECT_RATIO,
    );

    expect(result.x).toBe(1920);
    expect(result.y).toBe(1080);
  });

  // --- Different image dimensions ---

  it('handles small image (640x480)', () => {
    const result = computeWatermarkPixels(
      makeDraft({ xPct: 25, yPct: 75, widthPct: 30 }),
      640,
      480,
      LOGO_ASPECT_RATIO,
    );

    expect(result.x).toBe(160);       // 25% of 640
    expect(result.y).toBe(360);       // 75% of 480
    expect(result.width).toBe(192);   // 30% of 640
    expect(result.height).toBe(96);   // 192 / 2
  });

  it('handles portrait image (1080x1920)', () => {
    const result = computeWatermarkPixels(
      makeDraft({ xPct: 10, yPct: 90, widthPct: 50 }),
      1080,
      1920,
      LOGO_ASPECT_RATIO,
    );

    expect(result.x).toBe(108);       // 10% of 1080
    expect(result.y).toBe(1728);      // 90% of 1920
    expect(result.width).toBe(540);   // 50% of 1080
    expect(result.height).toBe(270);  // 540 / 2
  });

  // --- Opacity conversion ---

  it('converts 0% opacity to 0.0', () => {
    const result = computeWatermarkPixels(
      makeDraft({ opacityPct: 0 }),
      1920,
      1080,
      LOGO_ASPECT_RATIO,
    );

    expect(result.opacity).toBe(0);
  });

  it('converts 100% opacity to 1.0', () => {
    const result = computeWatermarkPixels(
      makeDraft({ opacityPct: 100 }),
      1920,
      1080,
      LOGO_ASPECT_RATIO,
    );

    expect(result.opacity).toBe(1.0);
  });

  it('converts 75% opacity to 0.75', () => {
    const result = computeWatermarkPixels(
      makeDraft({ opacityPct: 75 }),
      1920,
      1080,
      LOGO_ASPECT_RATIO,
    );

    expect(result.opacity).toBe(0.75);
  });

  // --- Logo aspect ratio ---

  it('calculates height from a 1:1 square logo', () => {
    const result = computeWatermarkPixels(
      makeDraft({ widthPct: 20 }),
      1000,
      1000,
      1.0, // square logo
    );

    expect(result.width).toBe(200);
    expect(result.height).toBe(200); // 200 / 1.0
  });

  it('calculates height from a 4:1 wide logo', () => {
    const result = computeWatermarkPixels(
      makeDraft({ widthPct: 40 }),
      1000,
      1000,
      4.0,
    );

    expect(result.width).toBe(400);
    expect(result.height).toBe(100); // 400 / 4.0
  });

  // --- Integer rounding ---

  it('rounds pixel values to integers', () => {
    // 33% of 1000 = 330.0 (no rounding needed)
    // 33% of 999 = 329.67 → should round
    const result = computeWatermarkPixels(
      makeDraft({ xPct: 33, yPct: 33, widthPct: 33 }),
      999,
      999,
      LOGO_ASPECT_RATIO,
    );

    expect(Number.isInteger(result.x)).toBe(true);
    expect(Number.isInteger(result.y)).toBe(true);
    expect(Number.isInteger(result.width)).toBe(true);
    expect(Number.isInteger(result.height)).toBe(true);
  });
});
