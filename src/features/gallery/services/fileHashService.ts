import { File as FSFile } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

/**
 * Compute the SHA-256 hash of a file at the given URI.
 *
 * Reads the file bytes via `expo-file-system` and hashes with `expo-crypto`.
 * The heavy lifting (read + hash) happens on the native side, so the JS thread
 * is not blocked for large files.
 *
 * Mirrors Flutter's `FileHashService.computeSha256`.
 */
export async function computeFileHash(uri: string): Promise<string> {
  // Only allow file:// URIs — reject network or crafted schemes
  if (!uri.startsWith('file://') && !uri.startsWith('/')) {
    throw new Error('Invalid file URI');
  }
  const file = new FSFile(uri);
  const bytes = await file.bytes();
  const hashBuffer = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytes,
  );
  // Convert ArrayBuffer to lowercase hex string
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
