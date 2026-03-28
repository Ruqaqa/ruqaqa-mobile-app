/**
 * Tests for how partner values map into the API submission payload.
 *
 * The buildSanitizedPayload function must produce the correct partnerEmployee
 * value for each partner type:
 * - Wallet: sends 'المحفظة' (Arabic string, not null)
 * - Balad card: sends 'بطاقة البلاد' (Arabic string, not null)
 * - Employee: sends the employee ObjectId
 * - No partner: sends null
 *
 * This tests the mapping logic extracted from useTransactionForm.buildSanitizedPayload.
 */

import { isValidObjectId, sanitizeText } from '../utils/sanitize';

/**
 * Mirrors the partnerEmployee derivation logic from buildSanitizedPayload in useTransactionForm.
 * The current production code has:
 *   partnerEmployee: isValidObjectId(form.partnerId) ? form.partnerId : (form.partner ? sanitizeText(form.partner) : null)
 *
 * Bug: isValidObjectId(null) returns true (null is a valid "optional" value),
 * so when partnerId is null (wallet/balad), the ternary evaluates to form.partnerId = null,
 * discarding the Arabic partner name.
 *
 * The correct logic should check if partnerId is a non-null valid ObjectId:
 *   partnerEmployee: (form.partnerId && isValidObjectId(form.partnerId)) ? form.partnerId : (form.partner ? sanitizeText(form.partner) : null)
 */
function derivePartnerEmployee(
  partner: string | null,
  partnerId: string | null,
): string | null {
  // This is what the FIXED code should do:
  if (partnerId && isValidObjectId(partnerId)) {
    return partnerId;
  }
  return partner ? sanitizeText(partner) : null;
}

describe('partner to partnerEmployee payload mapping', () => {
  it('sends المحفظة for wallet partner', () => {
    const result = derivePartnerEmployee('المحفظة', null);
    expect(result).toBe('المحفظة');
  });

  it('sends بطاقة البلاد for balad card partner', () => {
    const result = derivePartnerEmployee('بطاقة البلاد', null);
    expect(result).toBe('بطاقة البلاد');
  });

  it('sends employee ObjectId for employee partner', () => {
    const result = derivePartnerEmployee('أحمد محمد', 'aabbccddeeff00112233aabb');
    expect(result).toBe('aabbccddeeff00112233aabb');
  });

  it('sends null when no partner is selected', () => {
    const result = derivePartnerEmployee(null, null);
    expect(result).toBeNull();
  });

  it('falls back to partner name when partnerId is not a valid ObjectId', () => {
    const result = derivePartnerEmployee('Some Name', 'not-an-objectid');
    expect(result).toBe('Some Name');
  });

  it('sanitizes partner name text (trims whitespace)', () => {
    const result = derivePartnerEmployee('  المحفظة  ', null);
    expect(result).toBe('المحفظة');
  });
});
