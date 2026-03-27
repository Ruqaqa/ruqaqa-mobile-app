import { withAlpha } from '../colorUtils';

describe('withAlpha', () => {
  it('applies 10% alpha to a 6-char hex color', () => {
    expect(withAlpha('#1428a0', 0.1)).toBe('#1428a01a');
  });

  it('applies 50% alpha', () => {
    expect(withAlpha('#1428a0', 0.5)).toBe('#1428a080');
  });

  it('applies 100% alpha', () => {
    expect(withAlpha('#1428a0', 1)).toBe('#1428a0ff');
  });

  it('applies 0% alpha', () => {
    expect(withAlpha('#1428a0', 0)).toBe('#1428a000');
  });

  it('handles 3-char hex by expanding to 6-char', () => {
    expect(withAlpha('#fff', 0.5)).toBe('#ffffff80');
  });
});
