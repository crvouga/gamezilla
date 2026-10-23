import type { SavedPuzzleSource } from '@libs/chess-puzzle-shared-ts/puzzle-source';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { usePendingOperation } from '@pkgs/ui-root-client-ts/pending-navigation';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import { usePuzzleManagementApi } from './puzzle-management-api';
import { savePuzzleSource } from './save-puzzle-source';

export function usePuzzleSourceUpload(
  saved: (source: SavedPuzzleSource | null) => void
) {
  const connection = useSyncEngine();
  const createId = useCreateId();
  const upload = usePuzzleManagementApi();
  const [file, setFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [uploadedRows, setUploadedRows] = createSignal(0);
  const [uploadProgress, setUploadProgress] = createSignal(0);
  let controller: AbortController | undefined;
  usePendingOperation(uploading, () => controller?.abort());
  createEffect(() => {
    if (!connection.status().online && uploading())
      controller?.abort(
        new Error(
          'The Lichess file could not finish saving without a connection.'
        )
      );
  });
  onCleanup(() => controller?.abort());
  const save = async (): Promise<void> => {
    if (!connection.status().online)
      throw new Error('A connection is needed to save a Lichess file.');
    const selected = file();
    if (selected === null) throw new Error('Choose a Lichess CSV first.');
    if (uploading()) return;
    controller = new AbortController();
    const signal = controller.signal;
    const uploadId = createId();
    setUploading(true);
    setUploadedRows(0);
    setUploadProgress(0);
    try {
      const value = await savePuzzleSource(
        selected,
        {
          uploadId,
          signal,
          onProgress: setUploadedRows,
          onFileProgress: setUploadProgress,
        },
        upload
      );
      saved(value);
      setUploadProgress(1);
      setFile(null);
    } catch (error) {
      if (
        signal.aborted &&
        signal.reason instanceof Error &&
        signal.reason.name !== 'AbortError'
      )
        throw signal.reason;
      if (signal.aborted)
        throw new Error(
          'Saving stopped. Any complete saved file remains available.'
        );
      throw error;
    } finally {
      setUploading(false);
    }
  };
  return {
    file,
    setFile,
    uploading,
    uploadedRows,
    uploadProgress,
    save,
    abortUpload: () => controller?.abort(),
  };
}
