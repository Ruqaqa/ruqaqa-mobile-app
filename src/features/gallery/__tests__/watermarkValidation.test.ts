import type { WatermarkDraft } from '../types';
import { DEFAULT_WATERMARK_DRAFT, clampWatermarkDraft } from '../types';
import {
  isLocalFileUri,
  validateSafePath,
  sanitizeWatermarkSettings,
} from '../utils/watermarkValidation';

// ---------------------------------------------------------------------------
// clampWatermarkDraft
// ---------------------------------------------------------------------------

describe('clampWatermarkDraft', () => {
  it('returns defaults unchanged when within bounds', () => {
    const result = clampWatermarkDraft(DEFAULT_WATERMARK_DRAFT);

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    expect(result.yPct).toBe(DEFAULT_WATERMARK_DRAFT.yPct);
    expect(result.widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
    expect(result.opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
    expect(result.noWatermarkNeeded).toBe(DEFAULT_WATERMARK_DRAFT.noWatermarkNeeded);
  });

  // --- xPct clamping [0, 100] ---

  it('clamps xPct below 0 to 0', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, xPct: -10 };
    expect(clampWatermarkDraft(draft).xPct).toBe(0);
  });

  it('clamps xPct above 100 to 100', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, xPct: 150 };
    expect(clampWatermarkDraft(draft).xPct).toBe(100);
  });

  it('keeps xPct at 0 (boundary)', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, xPct: 0 };
    expect(clampWatermarkDraft(draft).xPct).toBe(0);
  });

  it('keeps xPct at 100 (boundary)', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, xPct: 100 };
    expect(clampWatermarkDraft(draft).xPct).toBe(100);
  });

  // --- yPct clamping [0, 100] ---

  it('clamps yPct below 0 to 0', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, yPct: -5 };
    expect(clampWatermarkDraft(draft).yPct).toBe(0);
  });

  it('clamps yPct above 100 to 100', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, yPct: 200 };
    expect(clampWatermarkDraft(draft).yPct).toBe(100);
  });

  // --- widthPct clamping [5, 80] ---

  it('clamps widthPct below 5 to 5', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, widthPct: 2 };
    expect(clampWatermarkDraft(draft).widthPct).toBe(5);
  });

  it('clamps widthPct above 80 to 80', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, widthPct: 95 };
    expect(clampWatermarkDraft(draft).widthPct).toBe(80);
  });

  it('keeps widthPct at 5 (lower boundary)', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, widthPct: 5 };
    expect(clampWatermarkDraft(draft).widthPct).toBe(5);
  });

  it('keeps widthPct at 80 (upper boundary)', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, widthPct: 80 };
    expect(clampWatermarkDraft(draft).widthPct).toBe(80);
  });

  // --- opacityPct clamping [10, 100] ---

  it('clamps opacityPct below 10 to 10', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, opacityPct: 0 };
    expect(clampWatermarkDraft(draft).opacityPct).toBe(10);
  });

  it('clamps opacityPct above 100 to 100', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, opacityPct: 120 };
    expect(clampWatermarkDraft(draft).opacityPct).toBe(100);
  });

  it('keeps opacityPct at 10 (lower boundary)', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, opacityPct: 10 };
    expect(clampWatermarkDraft(draft).opacityPct).toBe(10);
  });

  it('keeps opacityPct at 100 (upper boundary)', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, opacityPct: 100 };
    expect(clampWatermarkDraft(draft).opacityPct).toBe(100);
  });

  // --- NaN / Infinity handling ---
  // The official clampWatermarkDraft falls back to DEFAULT_WATERMARK_DRAFT for non-finite values.

  it('falls back NaN xPct to default', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, xPct: NaN };
    expect(clampWatermarkDraft(draft).xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
  });

  it('falls back Infinity widthPct to default', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, widthPct: Infinity };
    expect(clampWatermarkDraft(draft).widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
  });

  it('falls back -Infinity yPct to default', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, yPct: -Infinity };
    expect(clampWatermarkDraft(draft).yPct).toBe(DEFAULT_WATERMARK_DRAFT.yPct);
  });

  it('falls back NaN opacityPct to default', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, opacityPct: NaN };
    expect(clampWatermarkDraft(draft).opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
  });

  // --- noWatermarkNeeded passthrough ---

  it('preserves noWatermarkNeeded=true', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, noWatermarkNeeded: true };
    expect(clampWatermarkDraft(draft).noWatermarkNeeded).toBe(true);
  });

  it('preserves noWatermarkNeeded=false', () => {
    const draft: WatermarkDraft = { ...DEFAULT_WATERMARK_DRAFT, noWatermarkNeeded: false };
    expect(clampWatermarkDraft(draft).noWatermarkNeeded).toBe(false);
  });

  // --- Multiple out-of-bounds at once ---

  it('clamps all fields simultaneously when all are out of bounds', () => {
    const draft: WatermarkDraft = {
      xPct: -50,
      yPct: 300,
      widthPct: 0,
      opacityPct: 5,
      noWatermarkNeeded: false,
    };
    const result = clampWatermarkDraft(draft);

    expect(result.xPct).toBe(0);
    expect(result.yPct).toBe(100);
    expect(result.widthPct).toBe(5);
    expect(result.opacityPct).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// isLocalFileUri
// ---------------------------------------------------------------------------

describe('isLocalFileUri', () => {
  it('accepts file:// URIs', () => {
    expect(isLocalFileUri('file:///data/photos/photo.jpg')).toBe(true);
  });

  it('accepts absolute paths starting with /', () => {
    expect(isLocalFileUri('/data/photos/photo.jpg')).toBe(true);
  });

  it('rejects http:// URIs', () => {
    expect(isLocalFileUri('http://example.com/photo.jpg')).toBe(false);
  });

  it('rejects https:// URIs', () => {
    expect(isLocalFileUri('https://example.com/photo.jpg')).toBe(false);
  });

  it('rejects content:// URIs', () => {
    expect(isLocalFileUri('content://media/external/images/123')).toBe(false);
  });

  it('rejects data: URIs', () => {
    expect(isLocalFileUri('data:image/jpeg;base64,abc123')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isLocalFileUri('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSafePath
// ---------------------------------------------------------------------------

describe('validateSafePath', () => {
  it('accepts normal file:// paths', () => {
    expect(validateSafePath('file:///photos/photo.jpg')).toBe(true);
  });

  it('accepts absolute paths', () => {
    expect(validateSafePath('/data/photos/photo.jpg')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateSafePath('')).toBe(false);
  });

  it('rejects http:// URIs', () => {
    expect(validateSafePath('http://example.com/photo.jpg')).toBe(false);
  });

  it('rejects paths with double quotes', () => {
    expect(validateSafePath('file:///photos/photo"injection.jpg')).toBe(false);
  });

  it('rejects paths with backticks', () => {
    expect(validateSafePath('file:///photos/photo`cmd`.jpg')).toBe(false);
  });

  it('rejects paths with dollar sign', () => {
    expect(validateSafePath('file:///photos/$HOME/photo.jpg')).toBe(false);
  });

  it('rejects paths with null bytes', () => {
    expect(validateSafePath('file:///photos/photo\0.jpg')).toBe(false);
  });

  it('accepts paths with spaces', () => {
    expect(validateSafePath('file:///photos/my photo.jpg')).toBe(true);
  });

  it('accepts paths with unicode characters', () => {
    expect(validateSafePath('file:///photos/صورة.jpg')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sanitizeWatermarkSettings
// ---------------------------------------------------------------------------

describe('sanitizeWatermarkSettings', () => {
  it('parses valid API response with x/y/width/opacity fields', () => {
    const result = sanitizeWatermarkSettings({ x: 30, y: 70, width: 25, opacity: 80 });

    expect(result.xPct).toBe(30);
    expect(result.yPct).toBe(70);
    expect(result.widthPct).toBe(25);
    expect(result.opacityPct).toBe(80);
  });

  it('returns defaults for null input', () => {
    const result = sanitizeWatermarkSettings(null);

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    expect(result.yPct).toBe(DEFAULT_WATERMARK_DRAFT.yPct);
  });

  it('returns defaults for undefined input', () => {
    const result = sanitizeWatermarkSettings(undefined);

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
  });

  it('returns defaults for non-object input', () => {
    const result = sanitizeWatermarkSettings('not an object');

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
  });

  it('falls back to defaults for missing fields', () => {
    const result = sanitizeWatermarkSettings({ x: 15 });

    expect(result.xPct).toBe(15);
    expect(result.yPct).toBe(DEFAULT_WATERMARK_DRAFT.yPct);
    expect(result.widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
    expect(result.opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
  });

  it('falls back to defaults for string values in numeric fields', () => {
    const result = sanitizeWatermarkSettings({ x: 'not a number', y: 50 });

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    expect(result.yPct).toBe(50);
  });

  it('clamps out-of-range values', () => {
    const result = sanitizeWatermarkSettings({ x: -50, y: 300, width: 0, opacity: 5 });

    expect(result.xPct).toBe(0);
    expect(result.yPct).toBe(100);
    expect(result.widthPct).toBe(5);
    expect(result.opacityPct).toBe(10);
  });

  it('parses noWatermarkNeeded boolean', () => {
    const result = sanitizeWatermarkSettings({ noWatermarkNeeded: true });

    expect(result.noWatermarkNeeded).toBe(true);
  });

  it('defaults noWatermarkNeeded to false when not a boolean', () => {
    const result = sanitizeWatermarkSettings({ noWatermarkNeeded: 'yes' });

    expect(result.noWatermarkNeeded).toBe(false);
  });

  it('handles empty object', () => {
    const result = sanitizeWatermarkSettings({});

    expect(result.xPct).toBe(DEFAULT_WATERMARK_DRAFT.xPct);
    expect(result.yPct).toBe(DEFAULT_WATERMARK_DRAFT.yPct);
    expect(result.widthPct).toBe(DEFAULT_WATERMARK_DRAFT.widthPct);
    expect(result.opacityPct).toBe(DEFAULT_WATERMARK_DRAFT.opacityPct);
    expect(result.noWatermarkNeeded).toBe(false);
  });
});
