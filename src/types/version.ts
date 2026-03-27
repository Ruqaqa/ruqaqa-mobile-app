/**
 * Version check result from the backend.
 */
export interface VersionCheckResult {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  updateRequired: boolean;
  updateAvailable: boolean;
  downloadUrl?: string;
  updateTitle?: string;
  updateMessage?: string;
  releaseNotes?: string;
}
