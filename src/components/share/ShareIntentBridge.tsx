import { useEffect, useRef } from 'react';
import { useShareIntent as useExpoShareIntent } from 'expo-share-intent';
import { handleIncomingFiles } from '@/services/shareIntent';

/**
 * Invisible component that bridges expo-share-intent's hook
 * into our module-level shareIntentStore.
 *
 * Must be mounted inside the root layout so it's always active.
 * Renders nothing — just listens for shared content and forwards
 * validated files to the store.
 */
export function ShareIntentBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useExpoShareIntent({
    resetOnBackground: false,
  });
  const processedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent || !shareIntent.files || shareIntent.files.length === 0) {
      return;
    }

    // Deduplicate: don't re-process the same share event
    const key = shareIntent.files.map((f) => f.path).join('|');
    if (processedRef.current === key) return;
    processedRef.current = key;

    handleIncomingFiles(shareIntent.files);
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}
