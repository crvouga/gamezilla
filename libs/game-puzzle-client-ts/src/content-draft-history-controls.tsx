import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { JSX } from 'solid-js';
import type { useContentDraftSave } from './use-content-draft-save';

/** Undo and redo draft edits; each one is saved as another kept copy. */
export function ContentDraftHistoryControls(props: {
  writer: ReturnType<typeof useContentDraftSave>;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Button
        title={t`Undo edit`}
        intent="neutral"
        variant="outline"
        disabled={props.disabled || !props.writer.canUndo()}
        onClick={props.writer.undo}
        dataSet={{ testid: 'content-draft-undo' }}
      />
      <Button
        title={t`Redo edit`}
        intent="neutral"
        variant="outline"
        disabled={props.disabled || !props.writer.canRedo()}
        onClick={props.writer.redo}
        dataSet={{ testid: 'content-draft-redo' }}
      />
    </>
  );
}
