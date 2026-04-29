import { getMaxAllowedDateEndOfDay, MAX_FUTURE_DAYS } from '../dateLimits';

describe('getMaxAllowedDateEndOfDay', () => {
  it('returns end of day MAX_FUTURE_DAYS days ahead of given now', () => {
    const now = new Date(2026, 3, 29, 10, 30, 0, 0);
    const result = getMaxAllowedDateEndOfDay(now);

    const expected = new Date(2026, 3, 29 + MAX_FUTURE_DAYS, 23, 59, 59, 999);
    expect(result.getTime()).toBe(expected.getTime());
  });
});
