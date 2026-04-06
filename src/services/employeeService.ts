import { ValidateResponse } from '../types/auth';
import { Employee } from '../types/permissions';
import { apiClient } from './apiClient';

/**
 * Validate the current user's employee record against the backend.
 * Uses apiClient (which handles Bearer token and 401 retry automatically).
 */
export async function validateEmployee(): Promise<Employee | null> {
  try {
    const res = await apiClient.post<ValidateResponse>('/auth/validate', {});

    if (res.data.success && res.data.employee) {
      const { professionalPictureUrl, firstName, lastName, ...employee } = res.data.employee;
      return {
        ...employee,
        name: `${firstName ?? ''} ${lastName ?? ''}`.trim() || employee.email,
        avatarUrl: professionalPictureUrl ?? employee.avatarUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}
