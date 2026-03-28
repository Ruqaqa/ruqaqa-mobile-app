import { getFlowDirection } from '../utils/formatters';

describe('getFlowDirection', () => {
  describe('arrow direction based on amount', () => {
    it('returns "expense" for negative amount (money flows partner → other party)', () => {
      expect(getFlowDirection(-100)).toBe('expense');
    });

    it('returns "income" for positive amount (money flows other party → partner)', () => {
      expect(getFlowDirection(500)).toBe('income');
    });

    it('returns "income" for zero amount (not negative, so not expense)', () => {
      expect(getFlowDirection(0)).toBe('income');
    });
  });

  describe('edge cases', () => {
    it('returns "expense" for -0.01 (small negative)', () => {
      expect(getFlowDirection(-0.01)).toBe('expense');
    });

    it('returns "income" for 0.01 (small positive)', () => {
      expect(getFlowDirection(0.01)).toBe('income');
    });

    it('returns "expense" for very large negative amount', () => {
      expect(getFlowDirection(-999999.99)).toBe('expense');
    });

    it('returns "income" for very large positive amount', () => {
      expect(getFlowDirection(999999.99)).toBe('income');
    });
  });
});
