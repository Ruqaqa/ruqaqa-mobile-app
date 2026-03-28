import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/services/apiClient';
import {
  createAutocompleteSearch,
  AutocompleteSearch,
} from '../services/autocompleteSearchService';

jest.mock('@/services/apiClient', () => {
  const mockAxios = require('axios').create();
  return { apiClient: mockAxios };
});

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient as any);
  jest.useFakeTimers();
});

afterEach(() => {
  mock.restore();
  jest.useRealTimers();
});

describe('createAutocompleteSearch', () => {
  it('debounces search calls by 300ms', async () => {
    mock.onGet('/clients').reply(200, {
      success: true,
      clients: [{ id: '1', name: 'Acme' }],
    });

    const search = createAutocompleteSearch({
      endpoint: '/clients',
      resultKey: 'clients',
    });

    // Fire multiple searches rapidly
    search.search('A');
    search.search('Ac');
    search.search('Acm');

    // Before 300ms, no API call should have been made
    expect(mock.history.get).toHaveLength(0);

    // Advance past debounce
    jest.advanceTimersByTime(300);
    // Let the promise resolve
    await Promise.resolve();

    // Only the last search should have fired
    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].params.q).toBe('Acm');
  });

  it('returns results from API', async () => {
    mock.onGet('/clients').reply(200, {
      success: true,
      clients: [
        { id: '1', name: 'Acme Corp' },
        { id: '2', name: 'Acme Inc' },
      ],
    });

    const search = createAutocompleteSearch({
      endpoint: '/clients',
      resultKey: 'clients',
    });

    const resultPromise = search.search('Acme');
    jest.advanceTimersByTime(300);
    await Promise.resolve();

    const results = await resultPromise;
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Acme Corp');
  });

  it('falls back to local cache filtering when API fails', async () => {
    // First call succeeds, populating cache
    mock.onGet('/clients').replyOnce(200, {
      success: true,
      clients: [
        { id: '1', name: 'Acme Corp' },
        { id: '2', name: 'Beta LLC' },
      ],
    });

    const search = createAutocompleteSearch({
      endpoint: '/clients',
      resultKey: 'clients',
    });

    // Populate cache
    search.search('');
    jest.advanceTimersByTime(300);
    await Promise.resolve();

    // Second call fails
    mock.onGet('/clients').networkError();

    const resultPromise = search.search('Acme');
    jest.advanceTimersByTime(300);
    await Promise.resolve();

    const results = await resultPromise;
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Acme Corp');
  });

  it('returns empty array for empty search query when no cache', async () => {
    const search = createAutocompleteSearch({
      endpoint: '/other-parties',
      resultKey: 'otherParties',
      requireQuery: true,
    });

    const resultPromise = search.search('');
    jest.advanceTimersByTime(300);
    await Promise.resolve();

    const results = await resultPromise;
    expect(results).toEqual([]);
    // Should not have made an API call
    expect(mock.history.get).toHaveLength(0);
  });

  it('handles special characters in search query', async () => {
    mock.onGet('/clients').reply(200, {
      success: true,
      clients: [],
    });

    const search = createAutocompleteSearch({
      endpoint: '/clients',
      resultKey: 'clients',
    });

    search.search('Acme & Co. (test)');
    jest.advanceTimersByTime(300);
    await Promise.resolve();

    expect(mock.history.get).toHaveLength(1);
    expect(mock.history.get[0].params.q).toBe('Acme & Co. (test)');
  });

  it('cancels pending debounce when cancel is called', async () => {
    mock.onGet('/clients').reply(200, {
      success: true,
      clients: [],
    });

    const search = createAutocompleteSearch({
      endpoint: '/clients',
      resultKey: 'clients',
    });

    search.search('test');
    search.cancel();

    jest.advanceTimersByTime(300);
    await Promise.resolve();

    expect(mock.history.get).toHaveLength(0);
  });
});
