import type {
  CatalogueLoad,
  CatalogueLoadClient,
  CatalogueLoadJob,
} from '@libs/game-puzzle-client-ts/catalogue-load-client';
import { Trans } from '@lingui/solid/macro';
import { createMemo } from 'solid-js';
import { type PuzzleImportRow, usePuzzleImport } from './use-puzzle-import';

const JOB_STATUSES = ['adding', 'finished', 'failed', 'stopped'] as const;

/** The load row as the platform's loader shows it; none for an unknown status. */
function loadJob(row: PuzzleImportRow): CatalogueLoadJob | null {
  const status = JOB_STATUSES.find((known) => known === row.status);
  if (status === undefined) return null;
  return {
    status,
    source: row.cursor,
    progress:
      row.total_chunks > 0 ? row.completed_chunks / row.total_chunks : 0,
    processed: row.processed_rows,
    added: row.inserted_rows,
    updated: row.updated_rows,
    broken: row.failed_rows,
    duplicates: row.duplicate_rows,
    error: row.error,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

/**
 * Chess's catalogue load for the platform's loader: the saved Lichess file,
 * an upload of one, and the load of its puzzles into this environment.
 */
function useChessCatalogueLoad(): CatalogueLoad {
  const state = usePuzzleImport();
  const job = createMemo(() => {
    const row = state.job();
    return row === undefined ? null : loadJob(row);
  });
  const upload = createMemo(() =>
    state.uploading()
      ? { progress: state.uploadProgress(), puzzles: state.uploadedRows() }
      : null
  );
  const source = createMemo(() => ({
    known: state.source.known(),
    checking: state.source.loading(),
    error: state.source.error()?.message ?? null,
    filename: state.source.source()?.filename ?? null,
  }));
  return {
    decision: state.decision,
    online: () => state.connection.status().online,
    ready: state.ready,
    pool: () => state.job()?.pool_rows ?? null,
    job,
    source,
    chosenFile: state.file,
    upload,
    selectFile: state.setFile,
    save: state.save,
    recheck: state.source.reload,
    start: state.start,
    stop: state.stop,
  };
}

/** Chess's puzzle loader, as its settings and `/more/puzzles` open it. */
export const chessCatalogueLoad: CatalogueLoadClient = {
  useLoad: useChessCatalogueLoad,
  copy: {
    title: () => <Trans>Load chess puzzles</Trans>,
    subtitle: () => (
      <Trans>
        Upload a missing Lichess file, then load its puzzles into this
        environment.
      </Trans>
    ),
    sourceName: 'Lichess file',
    fileLabel: () => <Trans>Lichess puzzle database</Trans>,
    fileAccept: '.csv,.csv.zst,.zst,text/csv',
    fileHint: () => <Trans>Choose a .csv or .csv.zst file.</Trans>,
  },
};
