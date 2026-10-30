/**
 * Stop waiting for network work when its lifecycle ends. Keep handlers on the
 * abandoned promise so a late rejection is consumed, and never return its
 * late result to the caller that could apply it to a closed database.
 */
export function raceUntilAborted<T>(
  work: Promise<T>,
  signal: AbortSignal | null
): Promise<T | null> {
  if (signal?.aborted === true) {
    void work.then(
      () => undefined,
      () => undefined
    );
    return Promise.resolve(null);
  }
  if (signal === null) return work;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      resolve(null);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void work.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(signal.aborted ? null : value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (signal.aborted) resolve(null);
        else reject(error);
      }
    );
  });
}
