import type { SavedPuzzleSource } from '@libs/chess-puzzle-shared/puzzle-source';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useCreateId } from '@pkgs/uuid-client/solid';
import { createSignal, onCleanup } from 'solid-js';
import { usePuzzleManagementApi } from './puzzle-management-api';
import { uploadPuzzleSource } from './upload-puzzle-source';

export function usePuzzleSourceUpload(
  saved: (source: SavedPuzzleSource | null) => void
) {
  const connection = useSyncEngine();
  const createId = useCreateId();
  const upload = usePuzzleManagementApi();
  const [file, setFile] = createSignal<File | null>(null);
  const [uploading, setUploading] = createSignal(false);
  const [uploadedRows, setUploadedRows] = createSignal(0);
  let controller: AbortController | undefined;
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
    try {
      const chunks = await uploadPuzzleSource(
        selected,
        { uploadId, signal, onProgress: setUploadedRows },
        upload.upload
      );
      const value = await upload.save(
        { id: uploadId, filename: selected.name, chunks },
        signal
      );
      saved(value);
      setFile(null);
    } catch (error) {
      if (signal.aborted)
        throw new Error(
          'Saving stopped. The Lichess file has not been published.'
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
    save,
    abortUpload: () => controller?.abort(),
  };
}
