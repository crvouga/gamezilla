import {
  startPuzzleImport,
  stopPuzzleImport,
} from '@libs/chess-puzzle-shared/puzzle-import-mutations';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-root-shared/sql';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { useCreateId } from '@pkgs/uuid-client/solid';
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import { usePuzzleSourceUpload } from './use-puzzle-source-upload';
import { useSavedPuzzleSource } from './use-saved-puzzle-source';

export type PuzzleImportRow = {
  source_etag: string;
  status: string;
  cursor: string;
  processed_rows: number;
  inserted_rows: number;
  updated_rows: number;
  failed_rows: number;
  duplicate_rows: number;
  total_chunks: number;
  completed_chunks: number;
  pool_rows: number;
  error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export function usePuzzleImport() {
  const decision = useDecision(PERMISSION.puzzlesManage);
  const connection = useSyncEngine();
  const mutations = useMutationClient();
  const createId = useCreateId();
  const source = useSavedPuzzleSource(
    () => decision().allowed && connection.status().online
  );
  const sourceUpload = usePuzzleSourceUpload(source.setSource);
  const query = createQuery(
    () =>
      sql<PuzzleImportRow>`SELECT * FROM chess_puzzle_load WHERE id = 'dataset' AND deleted_at IS NULL`
  );
  const ready = useImportSubscription(
    () => decision().allowed && connection.status().online
  );
  const start = async (): Promise<void> => {
    const saved = source.source();
    if (saved === null)
      throw new Error('Save a Lichess file before adding puzzles.');
    const result = await mutations.mutate(startPuzzleImport, {
      uploadId: createId(),
      sourceId: saved.id,
      filename: saved.filename,
      chunks: saved.chunks,
    });
    if (!result.ok)
      throw new Error(
        result.failures.map((failure) => failure.message).join(' ')
      );
  };
  const stop = async (): Promise<void> => {
    sourceUpload.abortUpload();
    const job = query.rows()[0];
    if (job?.status !== 'adding') return;
    const result = await mutations.mutate(stopPuzzleImport, {
      uploadId: job.source_etag,
    });
    if (!result.ok)
      throw new Error(
        result.failures.map((failure) => failure.message).join(' ')
      );
  };
  return {
    decision,
    connection,
    ready,
    ...sourceUpload,
    job: () => query.rows()[0],
    source,
    start,
    stop,
  };
}

function useImportSubscription(allowed: () => boolean) {
  const sync = useSyncEngineInstance();
  const [ready, setReady] = createSignal(false);
  const enabled = createMemo(allowed);
  createEffect(() => {
    setReady(false);
    if (!enabled()) return;
    const held = untrack(() =>
      sync.subscribeQueries([{ name: 'chessPuzzleImport', params: {} }])
    );
    let alive = true;
    void held.ready.then((ok) => {
      if (alive) setReady(ok);
    });
    onCleanup(() => {
      alive = false;
      held.unsubscribe();
    });
  });
  return ready;
}
