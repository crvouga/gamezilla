import { useSyncEngineInstance } from '@pkgs/sync-engine/solid';

/**
 * Spaces are live and shared, so starting or joining one needs the server.
 * Asks it (one query sweep) instead of trusting a status that only learns of
 * a lost connection on the next failed request, so the answer is current
 * both right after the connection drops and right after it comes back.
 */
export function useCheckConnection(): () => Promise<boolean> {
  const engine = useSyncEngineInstance();
  return async () => {
    await engine.refreshQueries().catch(() => undefined);
    return engine.status.getSnapshot().online;
  };
}
