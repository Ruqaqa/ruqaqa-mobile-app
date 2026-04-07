import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Linking } from 'react-native';

const APK_FILENAME = 'ruqaqa-update.apk';

export interface DownloadProgress {
  percent: number;
  bytesWritten: number;
  totalBytes: number;
}

/**
 * Download APK from URL with progress tracking, then trigger Android installer.
 * Falls back to opening URL in browser on failure or non-Android platforms.
 */
export async function downloadAndInstallApk(
  url: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(url);
    return { success: true };
  }

  const fileUri = `${LegacyFileSystem.cacheDirectory}${APK_FILENAME}`;

  try {
    // Clean up any previous download
    await LegacyFileSystem.deleteAsync(fileUri, { idempotent: true });

    // Download with progress
    const downloadResumable = LegacyFileSystem.createDownloadResumable(
      url,
      fileUri,
      {},
      (downloadProgress) => {
        if (downloadProgress.totalBytesExpectedToWrite > 0) {
          const percent = Math.round(
            (downloadProgress.totalBytesWritten /
              downloadProgress.totalBytesExpectedToWrite) *
              100,
          );
          onProgress?.({
            percent,
            bytesWritten: downloadProgress.totalBytesWritten,
            totalBytes: downloadProgress.totalBytesExpectedToWrite,
          });
        }
      },
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      return { success: false, error: 'Download returned no file' };
    }

    // Verify file is not empty
    const fileInfo = await LegacyFileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || (fileInfo as any).size === 0) {
      return { success: false, error: 'emptyFile' };
    }

    // Get content URI for the installer
    const contentUri = await LegacyFileSystem.getContentUriAsync(result.uri);

    // Launch Android package installer
    await IntentLauncher.startActivityAsync(
      'android.intent.action.INSTALL_PACKAGE',
      {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      },
    );

    return { success: true };
  } catch (error: any) {
    // Try fallback: open in browser
    try {
      await Linking.openURL(url);
      return { success: true, error: 'browserFallback' };
    } catch {
      return { success: false, error: error?.message ?? 'Unknown error' };
    }
  }
}
