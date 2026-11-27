import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { RedoIcon, UndoIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
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
            get idle() {
              return t`Undo`;
            },
            get loading() {
              return t`Undoing…`;
            },
            get success() {
              return t`Edit undone`;
            },
            get error() {
              return t`Try undoing again`;
            },
          }
        : {
            get idle() {
              return t`Redo`;
            },
            get loading() {
              return t`Redoing…`;
            },
            get success() {
              return t`Edit restored`;
            },
            get error() {
              return t`Try redoing again`;
            },
          },
    get disabled() {
      return (
        props.disabled ||
        !props.history.choices(props.writer.draftId())[direction]
      );
    },
  });
}

/**
 * Undo and redo of this session's draft edits; each keeps a new draft copy.
 * Small ghost buttons with their icons, side by side in the board's command
 * bar under the stage, on a phone too; one that cannot run is disabled,
 * never removed, so the bar never shifts. A failed step says so under them
 * with its retry.
 */
export function ContentDraftHistory(props: HistoryProps): JSX.Element {
  const { t } = useLingui();
  const undo = useDraftEditStep(props, 'undo');
  const redo = useDraftEditStep(props, 'redo');
  const failure = () => undo.error() ?? redo.error();
  return (
    <>
      <StackHorizontal gap="sm" justify="center" wrap>
        <Button
          {...undo.buttonProps}
          intent="neutral"
          variant="ghost"
          size="sm"
          startIcon={<UndoIcon size={16} />}
          dataSet={{ testid: 'content-undo-draft-edit' }}
        />
        <Button
          {...redo.buttonProps}
          intent="neutral"
          variant="ghost"
          size="sm"
          startIcon={<RedoIcon size={16} />}
          dataSet={{ testid: 'content-redo-draft-edit' }}
        />
      </StackHorizontal>
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
