import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type JSX, Show } from 'solid-js';
import type { DraftEditDirection } from './draft-edit-history';
import type { useContentDraftSave } from './use-content-draft-save';
import type { DraftEditHistoryTools } from './use-draft-edit-history';

type HistoryProps = {
  writer: ReturnType<typeof useContentDraftSave>;
  history: DraftEditHistoryTools;
  disabled: boolean;
};

function useDraftEditStep(props: HistoryProps, direction: DraftEditDirection) {
  const { t } = useLingui();
  return useMutationButton({
    operation: async () => {
      await props.writer.save();
      if (props.writer.dirty())
        throw new Error(t`Keep the current changes first. Try saving again.`);
      props.writer.adopt(
        await props.history.step(direction, props.writer.draftId())
      );
    },
    labels:
      direction === 'undo'
        ? {
            idle: t`Undo edit`,
            loading: t`Undoing…`,
            success: t`Edit undone`,
            error: t`Try undoing again`,
          }
        : {
            idle: t`Redo edit`,
            loading: t`Redoing…`,
            success: t`Edit restored`,
            error: t`Try redoing again`,
          },
    get disabled() {
      return (
        props.disabled ||
        !props.history.choices(props.writer.draftId())[direction]
      );
    },
  });
}

/** Undo and redo of this session's draft edits; each keeps a new draft copy. */
export function ContentDraftHistory(props: HistoryProps): JSX.Element {
  const { t } = useLingui();
  const undo = useDraftEditStep(props, 'undo');
  const redo = useDraftEditStep(props, 'redo');
  const failure = () => undo.error() ?? redo.error();
  return (
    <>
      <Button
        {...undo.buttonProps}
        intent="neutral"
        variant="outline"
        dataSet={{ testid: 'content-undo-draft-edit' }}
      />
      <Button
        {...redo.buttonProps}
        intent="neutral"
        variant="outline"
        dataSet={{ testid: 'content-redo-draft-edit' }}
      />
      <Show when={failure()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your draft is unchanged`}
            body={error().message}
            retry={{
              onClick: () => {
                void (undo.error() === null ? redo : undo).run();
              },
            }}
          />
        )}
      </Show>
    </>
  );
}
