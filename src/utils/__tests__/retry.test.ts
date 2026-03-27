import { withRetry, isRetryableError } from '../retry';
import axios, { AxiosError } from 'axios';

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      shouldRetry: () => true,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      shouldRetry: () => true,
    });

    // Advance past the first backoff delay (100ms * 2^0 = 100ms)
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after maxAttempts exhausted', async () => {
    const error = new Error('persistent');
    const fn = jest.fn().mockRejectedValue(error);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      shouldRetry: () => true,
    });

    // Catch the rejection early to prevent unhandled rejection warning,
    // then re-check below.
    const caught = promise.catch((e: unknown) => e);

    // Advance past all retry delays: 100ms + 200ms
    await jest.advanceTimersByTimeAsync(300);

    const result = await caught;
    expect(result).toBe(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects exponential backoff delays', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      shouldRetry: () => true,
    });

    // After 99ms the second attempt should not have fired yet
    await jest.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);

    // At 100ms the first retry fires (100 * 2^0 = 100)
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry delay is 100 * 2^1 = 200ms
    await jest.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe('ok');
  });

  it('throws immediately if shouldRetry returns false', async () => {
    const error = new Error('non-retryable');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow('non-retryable');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// isRetryableError
// ---------------------------------------------------------------------------

describe('isRetryableError', () => {
  it('returns true for network errors (no response)', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    // No response property — simulates network failure
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for 5xx server errors', () => {
    const err = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      config: {} as any,
      data: {},
    });
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns false for 4xx client errors', () => {
    const err = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as any,
      data: {},
    });
    expect(isRetryableError(err)).toBe(false);
  });

  it('returns false for non-Axios errors', () => {
    expect(isRetryableError(new Error('random'))).toBe(false);
    expect(isRetryableError(new TypeError('type'))).toBe(false);
    expect(isRetryableError('string error')).toBe(false);
  });
});
