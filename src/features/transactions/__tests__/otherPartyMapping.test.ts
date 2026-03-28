/**
 * Tests for other party autocomplete mapping logic.
 *
 * The TransactionFormScreen maps API results (which may lack `id` for
 * "previous" free-text entries) into AutocompleteItems with synthetic ids,
 * and sets otherPartyId to null for items without a real id.
 */

describe('other party search result mapping', () => {
  // This mirrors the mapping in handleOtherPartySearch
  function mapOtherPartyResults(
    results: { id?: string; name: string; type?: string }[],
  ) {
    return results.map((i) => ({
      id: i.id || `prev_${i.name}`,
      label: i.name,
      type: i.type as string,
      hasRealId: !!i.id,
    }));
  }

  it('assigns synthetic id to items without id', () => {
    const results = [{ name: 'Some Company', type: 'previous' }];
    const mapped = mapOtherPartyResults(results);

    expect(mapped[0].id).toBe('prev_Some Company');
    expect(mapped[0].hasRealId).toBe(false);
  });

  it('keeps real id for items that have one', () => {
    const results = [{ id: 'abc123', name: 'Client Corp', type: 'client' }];
    const mapped = mapOtherPartyResults(results);

    expect(mapped[0].id).toBe('abc123');
    expect(mapped[0].hasRealId).toBe(true);
  });

  it('preserves the type from the API response', () => {
    const results = [
      { id: 'x1', name: 'A', type: 'client' },
      { name: 'B', type: 'previous' },
    ];
    const mapped = mapOtherPartyResults(results);

    expect(mapped[0].type).toBe('client');
    expect(mapped[1].type).toBe('previous');
  });

  it('maps name to label', () => {
    const results = [{ id: 'x', name: 'Test Name', type: 'client' }];
    const mapped = mapOtherPartyResults(results);

    expect(mapped[0].label).toBe('Test Name');
  });
});

describe('other party select behavior', () => {
  // This mirrors the logic in handleOtherPartySelect
  function selectOtherParty(item: {
    id: string;
    label: string;
    type?: string;
    hasRealId?: boolean;
  }) {
    return {
      otherParty: item.label,
      otherPartyId: item.hasRealId ? item.id : null,
      otherPartyType: item.type ?? 'text',
    };
  }

  it('sets otherPartyId to null for items without real id', () => {
    const result = selectOtherParty({
      id: 'prev_Some Company',
      label: 'Some Company',
      type: 'previous',
      hasRealId: false,
    });

    expect(result.otherPartyId).toBeNull();
    expect(result.otherParty).toBe('Some Company');
  });

  it('uses real id when item has one', () => {
    const result = selectOtherParty({
      id: 'abc123',
      label: 'Client Corp',
      type: 'client',
      hasRealId: true,
    });

    expect(result.otherPartyId).toBe('abc123');
  });

  it('defaults type to text when not provided', () => {
    const result = selectOtherParty({
      id: 'prev_X',
      label: 'X',
      hasRealId: false,
    });

    expect(result.otherPartyType).toBe('text');
  });

  it('uses API-returned type', () => {
    const result = selectOtherParty({
      id: 'abc',
      label: 'Y',
      type: 'client',
      hasRealId: true,
    });

    expect(result.otherPartyType).toBe('client');
  });
});
