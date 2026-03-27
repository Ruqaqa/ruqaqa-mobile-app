/**
 * Creates a deduplicated async function: concurrent calls share a single
 * in-flight promise. Once resolved/rejected, the next call starts fresh.
 */
export function createDeduplicatedRefresh<T>(
  fn: () => Promise<T>,
): () => Promise<T> {
  let inflight: Promise<T> | null = null;

  return () => {
    if (inflight) return inflight;

    inflight = fn().finally(() => {
      inflight = null;
    });

    return inflight;
  };
}
