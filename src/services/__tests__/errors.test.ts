import axios, { AxiosError, AxiosHeaders } from 'axios';
import { ApiError, mapAxiosError } from '../errors';

describe('ApiError', () => {
  it('sets code and default message', () => {
    const err = new ApiError('FORBIDDEN');
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('FORBIDDEN');
    expect(err.name).toBe('ApiError');
  });

  it('sets custom message', () => {
    const err = new ApiError('UNKNOWN', 'Something went wrong');
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Something went wrong');
    expect(err.name).toBe('ApiError');
  });

  it('is an instance of Error', () => {
    const err = new ApiError('NETWORK');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('mapAxiosError', () => {
  function makeAxiosError(status?: number): AxiosError {
    const config = { headers: new AxiosHeaders() };
    if (status === undefined) {
      // Network error: no response
      const err = new AxiosError('Network Error', 'ERR_NETWORK', config as any);
      return err;
    }
    const err = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      config as any,
      {},
      { status, data: {}, statusText: 'Error', headers: {}, config: config as any },
    );
    return err;
  }

  it('maps 403 to FORBIDDEN', () => {
    const result = mapAxiosError(makeAxiosError(403));
    expect(result).toBeInstanceOf(ApiError);
    expect(result.code).toBe('FORBIDDEN');
  });

  it('maps 404 to NOT_FOUND', () => {
    const result = mapAxiosError(makeAxiosError(404));
    expect(result.code).toBe('NOT_FOUND');
  });

  it('maps network error (no response) to NETWORK', () => {
    const result = mapAxiosError(makeAxiosError());
    expect(result.code).toBe('NETWORK');
  });

  it('maps 500 to SERVER', () => {
    const result = mapAxiosError(makeAxiosError(500));
    expect(result.code).toBe('SERVER');
  });

  it('maps non-axios error to UNKNOWN', () => {
    const result = mapAxiosError(new Error('some random error'));
    expect(result.code).toBe('UNKNOWN');
  });

  it('maps string error to UNKNOWN', () => {
    const result = mapAxiosError('string error');
    expect(result.code).toBe('UNKNOWN');
  });
});
