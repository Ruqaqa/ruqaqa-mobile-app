/**
 * Tests for how partner values map into the API submission payload.
 *
 * The buildSanitizedPayload function must produce the correct partnerEmployee
 * value for each partner type:
 * - Wallet: sends WALLET_PARTNER (Arabic string, not null)
 * - Balad card: sends BALAD_CARD_PARTNER (Arabic string, not null)
 * - Employee: sends the employee ObjectId
 * - No partner: sends null
 *
 * This tests the mapping logic extracted from useTransactionForm.buildSanitizedPayload.
 */

import { isValidObjectId, sanitizeText } from '../utils/sanitize';
import { WALLET_PARTNER, BALAD_CARD_PARTNER } from '../types';

/**
 * Mirrors the partnerEmployee derivation logic from buildSanitizedPayload in useTransactionForm.
 */
function derivePartnerEmployee(
  partner: string | null,
  partnerId: string | null,
): string | null {
  if (partnerId && isValidObjectId(partnerId)) {
    return partnerId;
  }
  return partner ? sanitizeText(partner) : null;
}

describe('partner to partnerEmployee payload mapping', () => {
  it('sends المحفظة for wallet partner', () => {
    const result = derivePartnerEmployee(WALLET_PARTNER, null);
    expect(result).toBe(WALLET_PARTNER);
  });

  it('sends بطاقة البلاد for balad card partner', () => {
    const result = derivePartnerEmployee(BALAD_CARD_PARTNER, null);
    expect(result).toBe(BALAD_CARD_PARTNER);
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
    const result = derivePartnerEmployee(`  ${WALLET_PARTNER}  `, null);
    expect(result).toBe(WALLET_PARTNER);
  });
});
