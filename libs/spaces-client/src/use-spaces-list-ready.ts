import { useSyncEngineInstance } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createSignal, onCleanup, onMount } from 'solid-js';

/**
 * True once this device's session queries have answered, so the hosted-space
 * count is the server's count (including zero) and not "still loading".
 */
export function useSpacesListReady(): Accessor<boolean> {
  const engine = useSyncEngineInstance();
  const [ready, setReady] = createSignal(false);
  onMount(() => {
    let cancelled = false;
    void engine.waitForFirstSync().then(() => {
      if (!cancelled) setReady(true);
    });
    onCleanup(() => {
      cancelled = true;
    });
  });
  return ready;
}
