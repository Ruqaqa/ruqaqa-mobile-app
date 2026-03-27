import axios, { AxiosError } from 'axios';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
}

/**
 * Execute an async function with exponential backoff retry.
 * Retries up to `maxAttempts` total calls. Delays between retries grow
 * as `baseDelayMs * 2^(attempt-1)`.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === opts.maxAttempts || !opts.shouldRetry(err)) throw err;
      const delay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/**
 * Returns true if the error is retryable: network errors (no response)
 * or 5xx server errors. Returns false for 4xx or non-Axios errors.
 */
export function isRetryableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const e = err as AxiosError;
  if (!e.response) return true;
  return e.response.status >= 500;
}
