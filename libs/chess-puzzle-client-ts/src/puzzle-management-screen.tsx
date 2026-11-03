import { useDenialView } from '@libs/permissions-client-ts/denial-surface';
import type { JSX } from 'solid-js';
import { PuzzleManagementScreenView } from './puzzle-management-screen-view';
import { usePuzzleImport } from './use-puzzle-import';

/** `/more/puzzles`: wires `PuzzleManagementScreenView` to storage and sync. */
export function PuzzleManagementScreen(props: {
  embedded?: boolean;
}): JSX.Element {
  const state = usePuzzleImport();
  const denial = useDenialView({
    get decision() {
      return state.decision();
    },
  });
  return (
    <PuzzleManagementScreenView
      embedded={props.embedded}
      denial={state.decision().allowed ? undefined : denial()}
      online={state.connection.status().online}
      ready={state.ready()}
      job={state.job() ?? null}
      source={{
        known: state.source.known(),
        loading: state.source.loading(),
        error: state.source.error()?.message ?? null,
        filename: state.source.source()?.filename ?? null,
      }}
      chosenFile={state.file()}
      uploading={state.uploading()}
      uploadProgress={state.uploadProgress()}
      uploadedRows={state.uploadedRows()}
      onSelectFile={state.setFile}
      onSave={state.save}
      onRecheck={state.source.reload}
      onStart={state.start}
      onStop={state.stop}
    />
  );
}
