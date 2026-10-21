import { startPuzzleImport } from '@libs/chess-puzzle-shared-ts/puzzle-import-mutations';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { useMutationClient } from '@pkgs/sync-engine-client-ts/mutation-client-context';
import {
  createQuery,
  useSyncEngine,
  useSyncEngineInstance,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import { usePuzzleSourceUpload } from './use-puzzle-source-upload';
import { usePuzzleStop } from './use-puzzle-stop';
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
  createEffect(() => {
    if (source.source() !== null) sourceUpload.setFile(null);
  });
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
  const stopping = usePuzzleStop(
    () => query.rows()[0],
    sourceUpload.abortUpload
  );
  return {
    decision,
    connection,
    ready,
    ...sourceUpload,
    job: stopping.job,
    source,
    start,
    stop: stopping.stop,
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
