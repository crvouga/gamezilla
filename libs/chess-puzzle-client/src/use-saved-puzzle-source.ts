import type { SavedPuzzleSource } from '@libs/chess-puzzle-shared/puzzle-source';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { usePuzzleManagementApi } from './puzzle-management-api';

/** Availability is metadata of the shared external file, refreshed on opening or reconnect. */
export function useSavedPuzzleSource(allowed: () => boolean) {
  const api = usePuzzleManagementApi();
  const enabled = createMemo(allowed);
  const [revision, setRevision] = createSignal(0);
  const [source, setSource] = createSignal<SavedPuzzleSource | null>(null);
  const [known, setKnown] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);
  createEffect(() => {
    revision();
    if (!enabled()) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setKnown(false);
    setLoading(true);
    setError(null);
    void api
      .read(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setSource(value);
        setKnown(true);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause : new Error(String(cause)));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    onCleanup(() => controller.abort());
  });
  return {
    source,
    known,
    loading,
    error,
    setSource,
    reload: () => setRevision((value) => value + 1),
  };
}
