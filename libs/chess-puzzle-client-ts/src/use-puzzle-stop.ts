import { stopPuzzleImport } from '@libs/chess-puzzle-shared-ts/puzzle-import-mutations';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import { type Accessor, createMemo, createSignal } from 'solid-js';

/** Keep the last confirmed addition stage while its stop awaits a verdict. */
export function usePuzzleStop<
  T extends {
    status: string;
    source_etag: string;
    finished_at: string | null;
  },
>(current: Accessor<T | undefined>, abortUpload: () => void) {
  const mutations = useMutationClient();
  const [stopping, setStopping] = createSignal(false);
  const job = createMemo(() => {
    const value = current();
    return stopping() && value?.status === 'stopped'
      ? { ...value, status: 'adding', finished_at: null }
      : value;
  });
  const stop = async (): Promise<void> => {
    abortUpload();
    const value = current();
    if (value?.status !== 'adding') return;
    setStopping(true);
    try {
      const result = await mutations.mutate(stopPuzzleImport, {
        uploadId: value.source_etag,
      });
      if (!result.ok)
        throw new Error(
          result.failures.map((failure) => failure.message).join(' ')
        );
    } finally {
      setStopping(false);
    }
  };
  return { stop, job };
}
