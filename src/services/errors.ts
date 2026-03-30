import axios from 'axios';

export type ApiErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'NETWORK' | 'SERVER' | 'UNKNOWN';

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export function mapAxiosError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 403) return new ApiError('FORBIDDEN');
    if (status === 404) return new ApiError('NOT_FOUND');
    if (!error.response) return new ApiError('NETWORK');
    return new ApiError('SERVER');
  }
  return new ApiError('UNKNOWN');
}
