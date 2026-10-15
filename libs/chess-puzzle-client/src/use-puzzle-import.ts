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
import { usePuzzleManagementApi } from './puzzle-management-api';
import { uploadPuzzleSource } from './upload-puzzle-source';

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
  const upload = usePuzzleManagementApi();
  const [file, setFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [uploadedRows, setUploadedRows] = createSignal(0);
  let controller: AbortController | undefined;
  const query = createQuery(
    () =>
      sql<PuzzleImportRow>`SELECT * FROM chess_puzzle_load WHERE id = 'dataset' AND deleted_at IS NULL`
  );
  const ready = useImportSubscription(
    () => decision().allowed && connection.status().online
  );
  onCleanup(() => controller?.abort());
  const start = async (): Promise<void> => {
    const selected = file();
    if (selected === null) throw new Error('Choose a Lichess CSV first.');
    if (uploading()) return;
    controller = new AbortController();
    const signal = controller.signal;
    const uploadId = createId();
    setUploading(true);
    setUploadedRows(0);
    try {
      const chunks = await uploadPuzzleSource(
        selected,
        { uploadId, signal, onProgress: setUploadedRows },
        upload
      );
      const result = await mutations.mutate(startPuzzleImport, {
        uploadId,
        filename: selected.name,
        chunks,
      });
      if (!result.ok)
        throw new Error(
          result.failures.map((failure) => failure.message).join(' ')
        );
    } catch (error) {
      if (signal.aborted)
        throw new Error(
          'Upload stopped. No puzzles were added from this file.'
        );
      throw error;
    } finally {
      setUploading(false);
    }
  };
  const stop = async (): Promise<void> => {
    controller?.abort();
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
    file,
    setFile,
    uploading,
    uploadedRows,
    job: () => query.rows()[0],
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
